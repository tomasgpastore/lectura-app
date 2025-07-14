# Outbound pipeline - handles query → retrieve → LLM response
import logging
import base64
import json
from typing import List, Dict, Any, Optional, AsyncGenerator
from openai import AsyncOpenAI
from pinecone.grpc.pinecone import PineconeGRPC as Pinecone
from upstash_redis.asyncio import Redis
import google.generativeai as genai
from pydantic import BaseModel

from app.config import get_env_var

# Configure logging
logger = logging.getLogger(__name__)

# Foundation prompt
FOUNDATION_PROMPT = "Respond in Markdown format. Respond according to the following sources:"

class OutboundRequest(BaseModel):
    course_id: str
    user_id: str
    user_prompt: str
    snapshot: Optional[str] = None  # base64 encoded current page from PDF

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant" 
    content: str
    timestamp: Optional[str] = None

class Source(BaseModel):
    slide_id: str
    page_start: int
    page_end: int
    raw_text: str

class OutboundResponse(BaseModel):
    llm_response: str
    sources: List[Source]

async def calculate_embedding(text: str) -> List[float]:
    """Calculate embedding using OpenAI text-embedding-3-small model"""
    try:
        client = AsyncOpenAI(api_key=get_env_var('OPENAI_API_KEY'))
        
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
            encoding_format="float"
        )
        
        return response.data[0].embedding
        
    except Exception as e:
        logger.error(f"Error calculating embedding: {str(e)}")
        raise

async def retrieve_similar_vectors(
    course_id: str, 
    query_embedding: List[float], 
    top_k: int = 10
) -> List[Dict[str, Any]]:
    """Retrieve top k similar vectors from Pinecone with courseId filter"""
    try:
        api_key = get_env_var('PINECONE_API_KEY')
        if not api_key:
            raise ValueError("PINECONE_API_KEY environment variable not set")
        
        pc = Pinecone(api_key=api_key)
        
        # Assume index name follows a pattern or is configured
        index_name = get_env_var('PINECONE_INDEX_NAME')

        if not index_name:
            raise ValueError("PINECONE_INDEX_NAME environment variable not set")
            
        index = pc.Index(index_name)
        
        # Query with course_id filter
        query_response = index.query(
            vector=query_embedding,
            filter={"courseId": course_id},
            top_k=top_k,
            include_metadata=True
        )
        
        results = []
        for match in query_response.matches:
            if match.metadata: #and match.score >= 0.5:
                results.append({
                    "score": match.score,
                    "metadata": match.metadata
                })
        
        return results
        
    except Exception as e:
        logger.error(f"Error retrieving vectors from Pinecone: {str(e)}")
        raise

async def get_chat_history(
    user_id: str, 
    course_id: str, 
    limit: int = 10
) -> List[ChatMessage]:
    """Get last 10 messages from Redis chat database"""
    try:
        redis_url = get_env_var('UPSTASH_REDIS_REST_URL')
        redis_token = get_env_var('UPSTASH_REDIS_REST_TOKEN')
        
        if not redis_url or not redis_token:
            logger.warning("Redis credentials not configured, returning empty chat history")
            return []
            
        redis = Redis(url=redis_url, token=redis_token)
        
        # Use a key pattern like "chat:{course_id}:{user_id}"
        chat_key = f"chat:{course_id}:{user_id}"
        
        # Get the last N messages (assuming they're stored as a list)
        messages_data = await redis.lrange(chat_key, -limit, -1)
        
        messages = []
        for msg_data in messages_data:
            if isinstance(msg_data, (bytes, str)):
                try:
                    msg_dict = json.loads(msg_data)
                    messages.append(ChatMessage(**msg_dict))
                except json.JSONDecodeError:
                    logger.warning(f"Could not parse message: {msg_data}")
        
        return messages
        
    except Exception as e:
        logger.error(f"Error retrieving chat history: {str(e)}")
        # Return empty list if Redis fails - don't break the pipeline
        return []

def construct_llm_query(
    user_prompt: str,
    chat_history: List[ChatMessage],
    retrieved_chunks: List[Dict[str, Any]],
    snapshot: Optional[str] = None
) -> str:
    """Structure LLM query with chat history, foundation prompt, sources, and user prompt"""
    
    # Start with foundation prompt
    query_parts = [FOUNDATION_PROMPT]
    
    # Add retrieved sources
    if retrieved_chunks:
        query_parts.append("\n{\nNEW SOURCE\n")
        for i, chunk in enumerate(retrieved_chunks, 1):
            metadata = chunk.get("metadata", {})
            raw_text = metadata.get("rawText", "")
            slide_id = metadata.get("slideId", "unknown")
            page_start = metadata.get("pageStart", 0)
            page_end = metadata.get("pageEnd", 0)
            
            query_parts.append(f"\n[{i}] From Slide: {slide_id}, Pages: {page_start} to {page_end}):")
            query_parts.append(raw_text)
    
    # Add chat history context
    if chat_history:
        query_parts.append("\n{\nPREVIOUS CONVERSATIONS\n")
        for msg in chat_history:
            role_label = "User" if msg.role == "user" else "Assistant"
            query_parts.append(f"\n{role_label}: \"{msg.content}\"")
    
    # Add snapshot information if available
    if snapshot:
        query_parts.append(f"\nPAGE USER IS VIEWING")
        query_parts.append("The user is currently viewing a page from the PDF (provided as base64 image data).")
    
    # Add current user prompt
    query_parts.append(f"\nUSER QUESTION")
    query_parts.append(user_prompt)
    
    return "\n".join(query_parts)

async def stream_gemini_response(
    query: str, 
    snapshot: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """Stream response from Gemini 2.5 Flash model"""
    try:
        # Configure Gemini API
        google_api_key = get_env_var('GOOGLE_API_KEY')
        if not google_api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        
        genai.configure(api_key=google_api_key)
        
        # Initialize model
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Prepare prompt parts (can contain strings and image dicts)
        prompt_parts: List[Any] = [query]
        
        # Add image if snapshot provided
        if snapshot:
            try:                
                # Determine mime type (assume PNG if not specified, can be made configurable)
                mime_type = "image/png"  # Default to PNG
                if snapshot.startswith('/9j/'):  # JPEG magic bytes in base64
                    mime_type = "image/jpeg"
                
                image_part = {
                    "mime_type": mime_type,
                    "data": snapshot
                }
                
                # Insert image at the beginning
                prompt_parts.insert(0, image_part)
                logger.info(f"Added image with mime_type: {mime_type}")
                
            except Exception as e:
                logger.warning(f"Could not process snapshot: {str(e)}")
        
        # Configure generation parameters
        generation_config = genai.types.GenerationConfig(
            temperature=0.3,
            top_p=0.95,
            max_output_tokens=4096,
        )

        # Generate streaming response
        response = model.generate_content(
            prompt_parts,
            generation_config=generation_config,
            stream=True
        )
        
        # Stream the response chunks
        for chunk in response:
            if chunk.text:
                yield chunk.text
                
    except Exception as e:
        logger.error(f"Error streaming Gemini response: {str(e)}")
        yield f"Error generating response: {str(e)}"

def extract_sources_from_chunks(retrieved_chunks: List[Dict[str, Any]]) -> List[Source]:
    """Extract source information from retrieved chunks"""
    sources = []
    
    for chunk in retrieved_chunks:
        metadata = chunk.get("metadata", {})
        
        try:
            source = Source(
                slide_id=metadata.get("slideId", "unknown"),
                page_start=int(metadata.get("pageStart", 0)),
                page_end=int(metadata.get("pageEnd", 0)),
                raw_text=metadata.get("rawText", "")
            )
            sources.append(source)
        except (ValueError, TypeError) as e:
            logger.warning(f"Could not parse source metadata: {e}")
            continue
    
    return sources

async def process_outbound_pipeline(request: OutboundRequest) -> AsyncGenerator[str, None]:
    """
    Main outbound pipeline function that processes the query and streams the response using SSE
    
    SSE Events:
    - event: sources (sent once at beginning with RAG sources as JSON)
    - event: token (sent repeatedly for each text chunk)
    - event: end (sent once at the end)
    """
    try:
        # Step 1: Calculate embedding
        logger.info(f"Calculating embedding for user prompt")
        query_embedding = await calculate_embedding(request.user_prompt)
        
        # Step 2: Retrieve similar vectors
        logger.info(f"Retrieving similar vectors for course_id: {request.course_id}")
        retrieved_chunks = await retrieve_similar_vectors(
            course_id=request.course_id,
            query_embedding=query_embedding,
            top_k=10
        )
        
        # Step 3: Get chat history
        logger.info(f"Retrieving chat history for user_id: {request.user_id}")
        chat_history = await get_chat_history(
            user_id=request.user_id,
            course_id=request.course_id,
            limit=10
        )
        logger.info(f"Retrieved {len(chat_history)} chat messages from Redis")
        
        # Step 4: Send sources event first
        sources = extract_sources_from_chunks(retrieved_chunks)
        sources_json = json.dumps([source.model_dump() for source in sources])
        yield f"event: sources\ndata: {sources_json}\n\n"
        
        # Step 5: Construct LLM query
        logger.info("Constructing LLM query")
        llm_query = construct_llm_query(
            user_prompt=request.user_prompt,
            chat_history=chat_history,
            retrieved_chunks=retrieved_chunks,
            snapshot=request.snapshot
        )
        logger.info(f"LLM query constructed - length: {len(llm_query)} chars, includes {len(chat_history)} chat messages")
        
        # Step 6: Stream response from Gemini
        logger.info("Streaming response from Gemini")
        
        async for chunk in stream_gemini_response(llm_query, request.snapshot):
            # Send each chunk as a token event
            yield f"event: token\ndata: {chunk}\n\n"
        
        # Step 7: Send end event
        yield f"event: end\ndata: Stream completed\n\n"
        
    except Exception as e:
        logger.error(f"Error in outbound pipeline: {str(e)}")
        error_message = f"Error processing request: {str(e)}"
        yield f"event: token\ndata: {error_message}\n\n"
        yield f"event: end\ndata: Stream completed with error\n\n"
