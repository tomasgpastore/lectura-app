"""
Agent tools for handling various operations including RAG search, web search, 
and source retrieval.
"""

import os
import logging
from typing import List, Dict, Any

# LangChain imports
from langchain_core.tools import tool
from langchain_community.tools.tavily_search import TavilySearchResults

# Local imports
from app.pipeline.outbound.agent_state import AgentStateManager
from app.pipeline.outbound.rag_retrieval import retrieve_similar_chunks_async

# Configure logging
logger = logging.getLogger(__name__)




# RAG Search Tool
@tool
async def rag_search_tool(
    query: str,
    course_id: str,
    slides_priority: List[str] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Search for relevant information in the course materials using RAG.
    
    Args:
        query: The search query optimized for vector search
        course_id: The course to search within
        slides_priority: Optional list of slide IDs to prioritize
        limit: Maximum number of results to return
    
    Returns:
        Dictionary containing search results and metadata
    """
    logger.info(f"RAG search - Query: '{query}', Course: {course_id}, Slides: {slides_priority}")
    
    try:
        # Use the real RAG retrieval function
        results = await retrieve_similar_chunks_async(
            course_id=course_id,
            slides=slides_priority or [],
            chunks=[],  # No chunk filtering
            prompt=query,
            limit=limit
        )
        
        # Format results for the agent
        formatted_results = []
        for i, result in enumerate(results, 1):
            metadata = result.get("metadata", {})
            formatted_results.append({
                "id": str(i),
                "slide": metadata.get("slideId", ""),
                "s3file": metadata.get("s3_path", ""),
                "start": str(metadata.get("pageStart", "")),
                "end": str(metadata.get("pageEnd", "")),
                "text": metadata.get("rawText", ""),
                "score": result.get("score", 0.0)
            })
        
        return {
            "success": True,
            "results": formatted_results,
            "count": len(formatted_results)
        }
        
    except Exception as e:
        logger.error(f"RAG search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "results": []
        }


# Web Search Tool
@tool
def web_search_tool(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Search the web for current information using Tavily.
    
    Args:
        query: The search query
        max_results: Maximum number of results to return
    
    Returns:
        Dictionary containing web search results
    """
    logger.info(f"Web search - Query: '{query}'")
    
    try:
        # Initialize Tavily search
        tavily_api_key = os.getenv("TAVILY_API_KEY")
        if not tavily_api_key:
            raise ValueError("TAVILY_API_KEY not found in environment")
        
        search = TavilySearchResults(
            api_key=tavily_api_key,
            max_results=max_results
        )
        
        # Perform search
        results = search.invoke(query)
        
        # Format results
        formatted_results = []
        for i, result in enumerate(results, 1):
            formatted_results.append({
                "id": str(i),
                "title": result.get("title", ""),
                "url": result.get("url", ""),
                "text": result.get("content", ""),
                "score": result.get("score", 0.0)
            })
        
        return {
            "success": True,
            "results": formatted_results,
            "count": len(formatted_results)
        }
        
    except Exception as e:
        logger.error(f"Web search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "results": []
        }


# Factory functions for context-bound tools
def create_retrieve_previous_sources_tool(state_manager: AgentStateManager, user_id: str, course_id: str):
    """Create a retrieve_previous_sources tool with bound context."""
    
    @tool
    async def retrieve_previous_sources(
        tool_message_ids: List[str]
    ) -> Dict[str, Any]:
        """
        Retrieve sources from previous tool calls in the conversation.
        
        Args:
            tool_message_ids: List of tool message IDs to retrieve sources for
        
        Returns:
            Dictionary containing the full source content from those tool calls
        """
        logger.info(f"Retrieving previous sources for tool messages: {tool_message_ids}")
        
        try:
            # Retrieve full tool messages
            tool_messages = await state_manager.get_tool_messages(
                user_id=user_id,
                course_id=course_id,
                tool_message_ids=tool_message_ids
            )
            
            # Combine all sources from the tool messages
            all_rag_sources = []
            all_web_sources = []
            all_image_sources = []
            
            for tool_msg_id, tool_data in tool_messages.items():
                content = tool_data.get("content", {})
                tool_name = tool_data.get("tool_name")
                
                if content.get("success"):
                    # Extract sources based on tool type
                    if tool_name == "rag_search_tool":
                        results = content.get("results", [])
                        for source in results:
                            source["from_tool_message"] = tool_msg_id
                            all_rag_sources.append(source)
                    
                    elif tool_name == "web_search_tool":
                        results = content.get("results", [])
                        for source in results:
                            source["from_tool_message"] = tool_msg_id
                            all_web_sources.append(source)
                    
                    elif tool_name in ["current_user_view", "previous_user_view"]:
                        # Image analysis results
                        image_info = {
                            "tool": tool_name,
                            "from_tool_message": tool_msg_id,
                            "query": content.get("query"),
                            "analysis": content.get("analysis"),
                            "slide_id": content.get("slide_id"),
                            "page_number": content.get("page_number")
                        }
                        all_image_sources.append(image_info)
            
            return {
                "success": True,
                "results": all_rag_sources + all_web_sources,  # Maintain backward compatibility
                "rag_sources": all_rag_sources,
                "web_sources": all_web_sources,
                "image_analyses": all_image_sources,
                "tool_message_count": len(tool_messages)
            }
            
        except Exception as e:
            logger.error(f"Error retrieving previous sources: {e}")
            return {
                "success": False,
                "error": str(e),
                "results": [],
                "rag_sources": [],
                "web_sources": [],
                "image_analyses": []
            }
    
    return retrieve_previous_sources


