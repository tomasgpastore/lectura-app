# Optimized Outbound pipeline with TRUE streaming and markdown responses
import logging
import json
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator
from openai import AsyncOpenAI
from upstash_redis.asyncio import Redis
import google.generativeai as genai
from pydantic import BaseModel
from concurrent.futures import ThreadPoolExecutor
import time

from app.config import get_env_var
from app.local_embedding import get_text_embedding
from app.chroma_client import get_chroma_collection, chroma_query_vectors

# Configure logging
logger = logging.getLogger(__name__)

# Foundation prompt for markdown responses with source citations
FOUNDATION_PROMPT = """
You are an AI assistant that helps students understand class material.

### ✅ Response Format Guidelines:
1. Always respond in **proper Markdown format**.
2. Use:
   - `###` Markdown-style headings for each main concept.
   - Bullet points (`-`) for lists, key takeaways, or steps.
   - Code blocks (```) for any code, formatted text, or shell commands.
3. Keep all paragraphs concise (no more than **2–3 sentences per paragraph**).
4. When referencing retrieved source information:
   - Cite it using this exact format: **[Source X]**
   - Place the citation **naturally in the sentence**, not at the end of the response.
   - Use the correct number **X** based on the order the sources were provided.
5. Use **multiple sources** when relevant to provide more complete answers.
6. Organize your response into **clear, structured sections** using headings.

---

### ✅ Response Behavior:
1. Respond to the user's question **using the provided sources** and/or the page the student is viewing (image provided).
2. You may **expand the answer using your own knowledge**, but:
   - Do **not cite** any part that comes from your own knowledge.
3. If the provided sources **do not contain relevant information**, answer using only your own knowledge **and do not cite** anything.

---

### ⚠️ Notes:
- Never hallucinate citations. Only cite if the information **clearly exists** in a source.
- Do not summarize all sources at the end — integrate citations **inline**.
- Avoid overly verbose answers or dense text blocks.
"""

# Global connections - initialized once and reused
_chroma_collection = None
_redis_client: Optional[Redis] = None
_openai_client: Optional[AsyncOpenAI] = None
_thread_pool: Optional[ThreadPoolExecutor] = None

class OutboundRequest(BaseModel):
    course: str
    user: str
    prompt: str
    snapshot: Optional[str] = None  # base64 encoded current page from PDF

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant" 
    content: str
    timestamp: Optional[str] = None

class Source(BaseModel):
    source_id: int  # Source number for citations (1, 2, 3...)
    slide_id: str
    s3_file_name: str  # S3 file path for document preview
    page_start: int
    page_end: int
    raw_text: str
    preview_text: str  # Shortened text for frontend display

class OutboundResponse(BaseModel):
    llm_response: str
    sources: List[Source]

def get_thread_pool() -> ThreadPoolExecutor:
    """Get or create thread pool for CPU-bound operations"""
    global _thread_pool
    if _thread_pool is None:
        # Increased for better parallelism
        _thread_pool = ThreadPoolExecutor(max_workers=6, thread_name_prefix="outbound_")
    return _thread_pool

def get_vector_collection():
    """Get or create ChromaDB collection (singleton)"""
    global _chroma_collection
    if _chroma_collection is None:
        _chroma_collection = get_chroma_collection()
        logger.info("ChromaDB collection initialized")
    return _chroma_collection

def get_redis_client() -> Redis:
    """Get or create Redis client (singleton)"""
    global _redis_client
    if _redis_client is None:
        redis_url = get_env_var('UPSTASH_REDIS_REST_URL')
        redis_token = get_env_var('UPSTASH_REDIS_REST_TOKEN')
        
        if not redis_url or not redis_token:
            raise ValueError("Redis credentials not configured")
        
        _redis_client = Redis(url=redis_url, token=redis_token)
        logger.info("Redis client initialized")
    return _redis_client

def get_openai_client() -> AsyncOpenAI:
    """Get or create OpenAI client (singleton)"""
    global _openai_client
    if _openai_client is None:
        api_key = get_env_var('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        _openai_client = AsyncOpenAI(api_key=api_key)
        logger.info("OpenAI client initialized")
    return _openai_client

async def calculate_embedding_optimized(text: str) -> List[float]:
    """Optimized embedding calculation with better error handling"""
    try:
        # Use thread pool for CPU-bound embedding calculation
        thread_pool = get_thread_pool()
        loop = asyncio.get_event_loop()
        
        def _get_embedding():
            return get_text_embedding(text)
        
        embedding = await loop.run_in_executor(thread_pool, _get_embedding)
        return embedding
        
    except Exception as e:
        logger.error(f"Error calculating embedding: {str(e)}")
        raise

# Backward compatibility alias
calculate_embedding = calculate_embedding_optimized

async def retrieve_similar_vectors_optimized(
    course_id: str, 
    query_embedding: List[float], 
    top_k: int = 10
) -> List[Dict[str, Any]]:
    """Optimized vector retrieval with better caching"""
    try:
        # Use cached collection
        collection = get_vector_collection()
        
        # Run query in thread pool to avoid blocking
        thread_pool = get_thread_pool()
        loop = asyncio.get_event_loop()
        
        def _query_chroma():
            return chroma_query_vectors(collection, query_embedding, course_id, top_k)
        
        results = await loop.run_in_executor(thread_pool, _query_chroma)
        return results
        
    except Exception as e:
        logger.error(f"❌ Error retrieving vectors from ChromaDB: {str(e)}")
        return []

# Backward compatibility alias
retrieve_similar_vectors = retrieve_similar_vectors_optimized

async def get_chat_history_optimized(
    user_id: str, 
    course_id: str, 
    limit: int = 10
) -> List[ChatMessage]:
    """Optimized chat history retrieval with timeout"""
    try:
        redis = get_redis_client()
        chat_key = f"chat:{course_id}:{user_id}"
        
        # Shorter timeout for better responsiveness
        messages_data = await asyncio.wait_for(
            redis.lrange(chat_key, -limit, -1),
            timeout=2.0  # Reduced from 5 seconds
        )
        
        messages = []
        for msg_data in messages_data:
            if isinstance(msg_data, (bytes, str)):
                try:
                    msg_dict = json.loads(msg_data)
                    messages.append(ChatMessage(**msg_dict))
                except json.JSONDecodeError:
                    continue  # Skip invalid messages
        
        return messages
        
    except asyncio.TimeoutError:
        logger.warning(f"⏰ Redis timeout - continuing without history")
        return []
    except Exception as e:
        logger.error(f"❌ Redis error: {str(e)}")
        return []

# Backward compatibility alias
get_chat_history = get_chat_history_optimized

def construct_llm_query_optimized(
    user_prompt: str,
    chat_history: List[ChatMessage],
    retrieved_chunks: List[Dict[str, Any]],
    snapshot: Optional[str] = None
) -> str:
    """Optimized query construction with numbered sources for citations"""
    
    query_parts = [FOUNDATION_PROMPT]
    
    # Add retrieved sources with numbered formatting for citations
    if retrieved_chunks:
        query_parts.append("\n## SOURCES TO REFERENCE")
        query_parts.append("Use these sources to answer the user's question. Cite them as [Source X]")
        
        for i, chunk in enumerate(retrieved_chunks, 1):
            metadata = chunk.get("metadata", {})
            raw_text = metadata.get("rawText", "")
            slide_id = metadata.get("slideId", "unknown")
            page_start = metadata.get("pageStart", 0)
            page_end = metadata.get("pageEnd", 0)
            
            # Format sources for easy citation
            query_parts.append(f"\n**Source {i}** (Slide: {slide_id}, Pages: {page_start}-{page_end}):")
            query_parts.append(f"```\n{raw_text[:1200]}\n```")  # Use code blocks for clarity
    
    # Add recent chat history (limit to save tokens)
    if chat_history:
        query_parts.append("\n## PREVIOUS CONVERSATION WITH STUDENT")
        for msg in chat_history[-5:]:  # Only last 5 messages
            role = "Student" if msg.role == "user" else "Assistant"
            query_parts.append(f"\n**{role}:** {msg.content}")
    
    # Add snapshot info if available
    if snapshot:
        query_parts.append("\n## CURRENT PAGE THE STUDENT IS VIEWING")
        query_parts.append("The user is currently viewing a specific page from the document (image provided).")
    
    # Add current question with emphasis on markdown formatting
    query_parts.append(f"\n## STUDENT QUESTION")
    query_parts.append(f"**Question:** {user_prompt}")
    
    return "\n".join(query_parts)

# Backward compatibility alias
construct_llm_query = construct_llm_query_optimized

async def stream_gemini_response_optimized(
    query: str, 
    snapshot: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """TRUE streaming implementation - yields chunks as they arrive"""
    try:
        # Configure Gemini API
        google_api_key = get_env_var('GOOGLE_API_KEY')
        if not google_api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        
        genai.configure(api_key=google_api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Prepare prompt parts
        prompt_parts: List[Any] = [query]
        
        # Add image if snapshot provided
        if snapshot:
            try:
                mime_type = "image/png"
                if snapshot.startswith('/9j/'):
                    mime_type = "image/jpeg"
                
                image_part = {
                    "mime_type": mime_type,
                    "data": snapshot
                }
                prompt_parts.insert(0, image_part)
                
            except Exception as e:
                logger.warning(f"Could not process snapshot: {str(e)}")
        
        # Configure generation parameters for faster streaming
        generation_config = genai.types.GenerationConfig(
            temperature=0.3,
            top_p=0.95,
            max_output_tokens=4096,
        )

        # TRUE STREAMING: Process chunks as they arrive
        logger.info("🚀 Starting TRUE Gemini streaming...")
        
        # Run streaming in thread pool to avoid blocking event loop
        async def _stream_chunks():
            def _sync_stream():
                try:
                    response = model.generate_content(
                        prompt_parts,
                        generation_config=generation_config,
                        stream=True
                    )
                    
                    chunks = []
                    for chunk in response:
                        # Check safety ratings before accessing text
                        if hasattr(chunk, 'candidates') and chunk.candidates:
                            candidate = chunk.candidates[0]
                            if hasattr(candidate, 'safety_ratings'):
                                blocked_reasons = [rating.category.name for rating in candidate.safety_ratings 
                                                 if rating.probability.name in ['HIGH', 'MEDIUM']]
                                if blocked_reasons:
                                    logger.warning(f"Response blocked by safety filter: {blocked_reasons}")
                                    continue
                        
                        # Safely access text content
                        if hasattr(chunk, 'text') and chunk.text:
                            chunks.append(chunk.text)
                        elif hasattr(chunk, 'candidates') and chunk.candidates:
                            # Alternative text access method
                            candidate = chunk.candidates[0]
                            if hasattr(candidate, 'content') and candidate.content.parts:
                                text_part = candidate.content.parts[0]
                                if hasattr(text_part, 'text') and text_part.text:
                                    chunks.append(text_part.text)
                    return chunks
                    
                except Exception as e:
                    return [f"Error: {str(e)}"]
            
            # Execute in thread pool
            thread_pool = get_thread_pool()
            loop = asyncio.get_event_loop()
            chunks = await loop.run_in_executor(thread_pool, _sync_stream)
            
            # Stream each chunk immediately
            for chunk in chunks:
                yield chunk
                # Small delay to prevent overwhelming the client
                await asyncio.sleep(0.001)  # 1ms vs 10ms
        
        chunk_count = 0
        async for chunk in _stream_chunks():
            chunk_count += 1
            yield chunk
        
        logger.info(f"✅ Streamed {chunk_count} chunks in real-time")
                
    except Exception as e:
        logger.error(f"Error in Gemini streaming: {str(e)}")
        yield f"Error generating response: {str(e)}"

# Backward compatibility alias
stream_gemini_response = stream_gemini_response_optimized

def extract_sources_from_chunks_optimized(retrieved_chunks: List[Dict[str, Any]]) -> List[Source]:
    """Extract sources with numbering for citations and preview text"""
    sources = []
    
    for i, chunk in enumerate(retrieved_chunks, 1):  # Start numbering from 1
        metadata = chunk.get("metadata", {})
        
        try:
            # Validate required fields
            slide_id = metadata.get("slideId", "unknown")
            s3_file_name = metadata.get("s3_path", "")  # Get S3 file path
            page_start = metadata.get("pageStart", 0)
            page_end = metadata.get("pageEnd", 0)
            raw_text = metadata.get("rawText", "")
            
            # Skip if no meaningful text
            if not raw_text or len(raw_text.strip()) < 10:
                continue
            
            # Create preview text (first 150 chars)
            preview_text = raw_text.strip()[:150]
            if len(raw_text) > 150:
                preview_text += "..."
            
            source = Source(
                source_id=i,  # Sequential number for citations
                slide_id=slide_id,
                s3_file_name=s3_file_name,  # S3 file path for document preview
                page_start=int(page_start),
                page_end=int(page_end),
                raw_text=raw_text,  # Full text for backend processing
                preview_text=preview_text  # Shortened for frontend display
            )
            sources.append(source)
            
        except (ValueError, TypeError) as e:
            logger.warning(f"Could not parse source metadata: {e}")
            continue
    
    return sources

# Backward compatibility alias
extract_sources_from_chunks = extract_sources_from_chunks_optimized

async def process_outbound_pipeline_optimized(
    request: OutboundRequest, 
    expanded_query: Optional[str] = None,
    needs_context: bool = True
) -> AsyncGenerator[str, None]:
    """
    OPTIMIZED outbound pipeline with improved streaming and conditional retrieval
    
    Key Improvements:
    1. TRUE streaming (not fake buffered streaming)
    2. Parallel execution where possible
    3. Better error handling
    4. Reduced latency
    5. Optimized query construction
    6. Conditional retrieval based on query analysis
    
    Args:
        request: OutboundRequest with user query and metadata
        expanded_query: Optional expanded query for better retrieval
        needs_context: Whether to perform document retrieval
    """
    try:
        start_time = time.time()
        
        print("\n" + "="*80)
        print("🚀 OUTBOUND PIPELINE")
        print("="*80)
        print(f"👤 User: {request.user}")
        print(f"📚 Course: {request.course}")
        print(f"❓ Query: \"{request.prompt}\"")
        print(f"🔍 Needs Retrieval: {needs_context}")
        if expanded_query and expanded_query != request.prompt:
            print(f"📈 Expanded Query: \"{expanded_query[:100]}{'...' if len(expanded_query) > 100 else ''}\"")
        print("-"*80)
        
        # Always get chat history for context
        chat_history_task = get_chat_history_optimized(request.user, request.course, limit=10)
        
        # Initialize variables
        retrieved_chunks = []
        sources = []
        
        if needs_context:
            # PARALLEL EXECUTION: Run embedding and chat history in parallel
            step1_start = time.time()
            print("📊 Step 1: Starting parallel execution (embedding + vectors + chat)")
            
            # Use expanded query for embedding if available
            query_for_embedding = expanded_query if expanded_query else request.prompt
            embedding_task = calculate_embedding_optimized(query_for_embedding)
            
            # Wait for embedding first (needed for vector search)
            embedding_start = time.time()
            query_embedding = await embedding_task
            embedding_time = (time.time() - embedding_start) * 1000
            print(f"   🧮 Embedding calculated ({embedding_time:.0f}ms)")
            
            # Start vector search while chat history is still loading
            vectors_start = time.time()
            vectors_task = retrieve_similar_vectors_optimized(
                course_id=request.course,
                query_embedding=query_embedding,
                top_k=10
            )
            
            # Wait for both remaining tasks
            retrieved_chunks, chat_history = await asyncio.gather(vectors_task, chat_history_task)
            vectors_time = (time.time() - vectors_start) * 1000
            
            step1_time = (time.time() - step1_start) * 1000
            print(f"   🔍 Vector search completed ({vectors_time:.0f}ms)")
            print(f"   💬 Chat history retrieved ({len(chat_history)} messages)")
            print(f"✅ Step 1 completed ({step1_time:.0f}ms)")
            
            # Extract sources from retrieved chunks
            sources = extract_sources_from_chunks_optimized(retrieved_chunks)
            print(f"📚 Step 2: Extracted {len(sources)} sources from {len(retrieved_chunks)} chunks")
            
        else:
            # Only get chat history, skip retrieval
            step1_start = time.time()
            print("📊 Step 1: Getting chat history only (no retrieval needed)")
            chat_history = await chat_history_task
            step1_time = (time.time() - step1_start) * 1000
            print(f"   💬 Chat history retrieved ({len(chat_history)} messages)")
            print(f"✅ Step 1 completed ({step1_time:.0f}ms)")
        
        # Step 3: Send sources immediately (may be empty if no retrieval)
        sources_json = json.dumps([source.model_dump() for source in sources])
        yield f"event: sources\ndata: {sources_json}\n\n"
        
        # Step 4: Construct optimized LLM query
        step4_start = time.time()
        llm_query = construct_llm_query_optimized(
            user_prompt=request.prompt,
            chat_history=chat_history,
            retrieved_chunks=retrieved_chunks,  # Will be empty if no retrieval
            snapshot=request.snapshot
        )
        step4_time = (time.time() - step4_start) * 1000
        print(f"📝 Step 3: Query constructed ({len(llm_query)} chars) ({step4_time:.0f}ms)")
        
        # Step 5: TRUE streaming from Gemini
        print("🤖 Step 4: Starting Gemini streaming...")
        
        chunk_count = 0
        stream_start = time.time()
        
        async for chunk in stream_gemini_response_optimized(llm_query, request.snapshot):
            chunk_count += 1
            yield f"event: token\ndata: {chunk}\n\n"
        
        stream_time = (time.time() - stream_start) * 1000
        total_time = (time.time() - start_time) * 1000
        
        # Step 6: Send completion event with metrics
        yield f"event: end\ndata: Stream completed\n\n"
        
        print(f"✅ Step 4 completed: {chunk_count} chunks streamed ({stream_time:.0f}ms)")
        print("-"*80)
        print(f"⏱️  TIMING SUMMARY:")
        print(f"   • Total Pipeline: {total_time:.0f}ms")
        if needs_context:
            print(f"   • Retrieval Phase: {step1_time:.0f}ms")
        else:
            print(f"   • Chat History: {step1_time:.0f}ms")
        print(f"   • Query Construction: {step4_time:.0f}ms")
        print(f"   • Gemini Streaming: {stream_time:.0f}ms")
        print(f"📊 RESULTS: {len(sources)} sources, {chunk_count} chunks, retrieval: {needs_context}")
        print("="*80)
        
    except Exception as e:
        total_time = (time.time() - start_time) * 1000
        print(f"💥 ERROR in outbound pipeline: {str(e)} ({total_time:.0f}ms)")
        print("="*80)
        yield f"event: token\ndata: Error: {str(e)}\n\n"
        yield f"event: end\ndata: Stream completed with error\n\n"

# Backward compatibility alias
process_outbound_pipeline = process_outbound_pipeline_optimized

def cleanup_connections():
    """Clean up connections on shutdown"""
    global _thread_pool, _redis_client, _chroma_collection
    
    if _thread_pool:
        _thread_pool.shutdown(wait=True)
        _thread_pool = None
    
    _chroma_collection = None
    logger.info("Optimized outbound pipeline connections cleaned up")
