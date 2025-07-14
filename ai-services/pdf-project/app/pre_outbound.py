# Pre-outbound pipeline - intelligent query analysis and expansion
import logging
import json
import asyncio
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from pydantic import BaseModel
from concurrent.futures import ThreadPoolExecutor

from app.config import get_env_var
from app.outbound_pipeline import ChatMessage

# Configure logging
logger = logging.getLogger(__name__)

class QueryAnalysisRequest(BaseModel):
    user_query: str
    course_id: str
    user_id: str

class QueryAnalysisResponse(BaseModel):
    expanded_query: str
    needs_context: bool
    reasoning: str

# Global thread pool for CPU-bound operations
_thread_pool: Optional[ThreadPoolExecutor] = None

def get_thread_pool() -> ThreadPoolExecutor:
    """Get or create thread pool for CPU-bound operations"""
    global _thread_pool
    if _thread_pool is None:
        _thread_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pre_outbound_")
    return _thread_pool

async def analyze_query_intent(
    user_query: str,
    chat_history: List[ChatMessage] = None
) -> QueryAnalysisResponse:
    """
    Analyze user query to determine if retrieval is needed and expand it for better search
    
    Args:
        user_query: The user's question/prompt
        chat_history: Recent conversation context
        
    Returns:
        QueryAnalysisResponse with expanded query and retrieval decision
    """
    try:
        # Configure Gemini API
        google_api_key = get_env_var('GOOGLE_API_KEY')
        if not google_api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        
        genai.configure(api_key=google_api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Build context from chat history
        conversation_context = ""
        if chat_history and len(chat_history) > 0:
            conversation_context = "\n\n## RECENT CONVERSATION:\n"
            for msg in chat_history[-5:]:  # Last 5 messages
                role = "User" if msg.role == "user" else "Assistant"
                conversation_context += f"**{role}:** {msg.content}\n"
        
        # Construct analysis prompt
        analysis_prompt = f"""You are a smart assistant helping determine whether a user query requires document retrieval, and how to expand it for better search results.

{conversation_context}

## CURRENT USER QUERY:
"{user_query}"

## INSTRUCTIONS:
Analyze this query and determine:

1. **needs_context**: Does this question likely require retrieving documents to answer well?
   - TRUE if: The question asks about specific concepts, facts, procedures, or detailed information that would benefit from document context
   - FALSE if: It's a follow-up question that can be answered from conversation context, a greeting, clarification request, or general/self-contained question

2. **expanded_query**: Rewrite the input to include context and detail for better retrieval quality
   - Add relevant keywords and synonyms
   - Include context from the conversation if helpful
   - Make it more specific and detailed
   - Keep the core intent but expand for better semantic search

3. **reasoning**: Brief explanation of your decision

## EXAMPLES:

User: "What is a monopoly?"
Response: {{"expanded_query": "What is a monopoly in business economics? Definition, characteristics, and types of monopolistic market structures", "needs_context": true, "reasoning": "This asks for specific business/economic concepts that would benefit from detailed source material"}}

User: "Can you explain that in simpler terms?"
Response: {{"expanded_query": "Can you explain the previous concept in simpler terms with easier language and examples?", "needs_context": false, "reasoning": "This is a follow-up question asking for clarification of previously discussed content"}}

User: "How do I build a startup?"
Response: {{"expanded_query": "How to build a successful startup company? Steps, strategies, business planning, and entrepreneurship best practices", "needs_context": true, "reasoning": "This asks for specific business advice and strategies that would benefit from comprehensive source material"}}

User: "Thank you, that was helpful"
Response: {{"expanded_query": "Thank you, that was helpful", "needs_context": false, "reasoning": "This is a social acknowledgment that doesn't require document retrieval"}}

## OUTPUT FORMAT:
Return ONLY a valid JSON object with the three fields: expanded_query, needs_context, and reasoning.

## YOUR ANALYSIS:"""

        # Generate analysis using Gemini
        def _generate_analysis():
            try:
                response = model.generate_content(
                    analysis_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.1,  # Low temperature for consistent analysis
                        max_output_tokens=500,
                    )
                )
                return response.text
            except Exception as e:
                logger.error(f"Error in Gemini analysis: {str(e)}")
                return None
        
        # Run analysis in thread pool
        thread_pool = get_thread_pool()
        loop = asyncio.get_event_loop()
        
        logger.info(f"🔍 Analyzing query: '{user_query[:50]}...'")
        analysis_text = await loop.run_in_executor(thread_pool, _generate_analysis)
        
        if not analysis_text:
            # Fallback analysis if Gemini fails
            logger.warning("Gemini analysis failed, using fallback logic")
            return _fallback_analysis(user_query, chat_history)
        
        # Parse JSON response
        try:
            # Clean the response text (remove markdown formatting if present)
            clean_text = analysis_text.strip()
            if clean_text.startswith('```json'):
                clean_text = clean_text[7:]
            if clean_text.endswith('```'):
                clean_text = clean_text[:-3]
            clean_text = clean_text.strip()
            
            analysis_data = json.loads(clean_text)
            
            # Validate required fields
            if not all(key in analysis_data for key in ['expanded_query', 'needs_context', 'reasoning']):
                raise ValueError("Missing required fields in analysis response")
            
            result = QueryAnalysisResponse(
                expanded_query=analysis_data['expanded_query'],
                needs_context=bool(analysis_data['needs_context']),
                reasoning=analysis_data['reasoning']
            )
            
            logger.info(f"✅ Query analysis completed:")
            logger.info(f"   Needs context: {result.needs_context}")
            logger.info(f"   Expanded: '{result.expanded_query[:100]}...'")
            logger.info(f"   Reasoning: {result.reasoning}")
            
            return result
            
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Failed to parse Gemini analysis response: {e}")
            logger.warning(f"Raw response: {analysis_text}")
            return _fallback_analysis(user_query, chat_history)
            
    except Exception as e:
        logger.error(f"Error in query analysis: {str(e)}")
        return _fallback_analysis(user_query, chat_history)

def _fallback_analysis(user_query: str, chat_history: List[ChatMessage] = None) -> QueryAnalysisResponse:
    """
    Fallback analysis using simple heuristics if Gemini fails
    """
    logger.info("Using fallback query analysis")
    
    # Simple heuristics to determine if context is needed
    query_lower = user_query.lower().strip()
    
    # Questions that likely don't need retrieval
    no_context_patterns = [
        "thank", "thanks", "hello", "hi", "bye", "goodbye",
        "can you explain", "what do you mean", "clarify", "rephrase",
        "tell me more", "elaborate", "simpler", "easier",
        "i don't understand", "confused", "unclear"
    ]
    
    # Questions that likely need retrieval
    context_patterns = [
        "what is", "how to", "how do", "explain", "define",
        "tell me about", "describe", "compare", "difference",
        "examples of", "types of", "methods", "strategies",
        "according to", "in the document", "in the book"
    ]
    
    needs_context = True  # Default to needing context
    reasoning = "Default analysis: assuming document context would be helpful"
    
    # Check for no-context patterns
    for pattern in no_context_patterns:
        if pattern in query_lower:
            needs_context = False
            reasoning = f"Follow-up or conversational query detected: '{pattern}'"
            break
    
    # Check for context patterns (only if we haven't already decided no context)
    if needs_context:
        for pattern in context_patterns:
            if pattern in query_lower:
                reasoning = f"Information-seeking query detected: '{pattern}'"
                break
    
    # Simple query expansion
    expanded_query = user_query
    if needs_context:
        # Add some basic expansion for better search
        if len(user_query.split()) <= 3:
            expanded_query = f"{user_query} - detailed explanation with examples and context"
    
    return QueryAnalysisResponse(
        expanded_query=expanded_query,
        needs_context=needs_context,
        reasoning=f"Fallback analysis: {reasoning}"
    )

async def get_chat_history_for_analysis(
    user_id: str, 
    course_id: str, 
    limit: int = 5
) -> List[ChatMessage]:
    """Get chat history for pre-outbound analysis (simplified version)"""
    try:
        # Import here to avoid circular imports
        from app.outbound_pipeline import get_chat_history_optimized
        
        return await get_chat_history_optimized(
            user_id=user_id,
            course_id=course_id,
            limit=limit
        )
    except Exception as e:
        logger.warning(f"Could not retrieve chat history for analysis: {e}")
        return []

async def process_pre_outbound_pipeline(request: QueryAnalysisRequest) -> QueryAnalysisResponse:
    """
    Main pre-outbound pipeline function that analyzes the query and determines retrieval needs
    
    Args:
        request: Contains user_query, course_id, and user_id
        
    Returns:
        QueryAnalysisResponse with expanded query and retrieval decision
    """
    import time
    start_time = time.time()
    
    try:
        print("\n" + "="*80)
        print("🧠 PRE-OUTBOUND ANALYSIS PIPELINE")
        print("="*80)
        print(f"👤 User: {request.user_id}")
        print(f"📚 Course: {request.course_id}")
        print(f"❓ Query: \"{request.user_query}\"")
        print("-"*80)
        
        # Step 1: Get chat history for context
        step1_start = time.time()
        chat_history = await get_chat_history_for_analysis(
            user_id=request.user_id,
            course_id=request.course_id,
            limit=5  # Only need recent context for analysis
        )
        step1_time = (time.time() - step1_start) * 1000
        print(f"📋 Step 1: Retrieved {len(chat_history)} chat messages ({step1_time:.0f}ms)")
        
        # Step 2: Analyze the query
        step2_start = time.time()
        analysis = await analyze_query_intent(
            user_query=request.user_query,
            chat_history=chat_history
        )
        step2_time = (time.time() - step2_start) * 1000
        print(f"🤖 Step 2: AI analysis completed ({step2_time:.0f}ms)")
        
        # Display results
        total_time = (time.time() - start_time) * 1000
        print("-"*80)
        print("📊 ANALYSIS RESULTS:")
        
        # Format as clean JSON
        result_json = {
            "needs_context": analysis.needs_context,
            "expanded_query": analysis.expanded_query,
            "reasoning": analysis.reasoning
        }
        
        import json
        print(json.dumps(result_json, indent=2, ensure_ascii=False))
        
        print("-"*80)
        print(f"⏱️  TIMING: Total: {total_time:.0f}ms | Chat: {step1_time:.0f}ms | Analysis: {step2_time:.0f}ms")
        print("="*80)
        
        return analysis
        
    except Exception as e:
        total_time = (time.time() - start_time) * 1000
        print(f"💥 ERROR in pre-outbound analysis: {str(e)}")
        print(f"🔄 Using fallback analysis... ({total_time:.0f}ms)")
        print("="*80)
        # Return fallback analysis on error
        return _fallback_analysis(request.user_query)

def cleanup_pre_outbound_connections():
    """Clean up connections on shutdown"""
    global _thread_pool
    
    if _thread_pool:
        _thread_pool.shutdown(wait=True)
        _thread_pool = None
    
    logger.info("Pre-outbound pipeline connections cleaned up")