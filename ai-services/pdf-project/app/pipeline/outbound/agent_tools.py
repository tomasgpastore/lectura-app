"""
Agent tools for handling various operations including RAG search, web search, 
image viewing, and source retrieval.
"""

import os
import logging
from typing import List, Dict, Any, Optional

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
        message_ids: List[str]
    ) -> Dict[str, Any]:
        """
        Retrieve sources from previous messages in the conversation.
        
        Args:
            message_ids: List of message IDs to retrieve sources for
        
        Returns:
            Dictionary containing previous sources
        """
        logger.info(f"Retrieving previous sources for messages: {message_ids}")
        
        try:
            # Retrieve sources
            sources = await state_manager.get_sources_for_messages(
                user_id=user_id,
                course_id=course_id,
                message_ids=message_ids
            )
            
            # Flatten and combine all sources
            all_rag_sources = []
            all_web_sources = []
            
            for message_id, source_data in sources.items():
                rag_sources = source_data.get("rag_sources", [])
                web_sources = source_data.get("web_sources", [])
                
                # Add message_id to each source for reference
                for source in rag_sources:
                    source["from_message"] = message_id
                    all_rag_sources.append(source)
                
                for source in web_sources:
                    source["from_message"] = message_id
                    all_web_sources.append(source)
            
            return {
                "success": True,
                "rag_sources": all_rag_sources,
                "web_sources": all_web_sources,
                "message_count": len(sources)
            }
            
        except Exception as e:
            logger.error(f"Error retrieving previous sources: {e}")
            return {
                "success": False,
                "error": str(e),
                "rag_sources": [],
                "web_sources": []
            }
    
    return retrieve_previous_sources


def create_current_user_view_tool(snapshot: Optional[str]):
    """Create a current_user_view tool with bound snapshot."""
    
    @tool
    def current_user_view() -> Dict[str, Any]:
        """
        View the current image/screenshot provided by the user.
        
        Returns:
            Dictionary containing the image data and status
        """
        logger.info("Accessing current user view")
        
        if not snapshot:
            return {
                "success": False,
                "error": "No snapshot provided in current query",
                "image": None
            }
        
        return {
            "success": True,
            "image": f"data:image/png;base64,{snapshot}",
            "type": "current",
            "description": "Current screenshot/image provided by the user"
        }
    
    return current_user_view


def create_previous_user_view_tool(state_manager: AgentStateManager, user_id: str, course_id: str):
    """Create a previous_user_view tool with bound context."""
    
    @tool
    async def previous_user_view(
        message_ids: List[str]
    ) -> Dict[str, Any]:
        """
        View images from previous messages in the conversation.
        
        Args:
            message_ids: List of message IDs to retrieve images for
            
        Returns:
            Dictionary containing previous images
        """
        logger.info(f"Retrieving previous images for messages: {message_ids}")
        
        try:
            # Retrieve images from state manager
            images = await state_manager.get_images_for_messages(
                user_id=user_id,
                course_id=course_id,
                message_ids=message_ids
            )
            
            if not images:
                return {
                    "success": False,
                    "error": "No images found for specified messages",
                    "images": []
                }
            
            # Format images for display
            formatted_images = []
            for message_id, image_data in images.items():
                formatted_images.append({
                    "message_id": message_id,
                    "image": f"data:image/png;base64,{image_data['image']}",
                    "timestamp": image_data.get("timestamp", ""),
                    "type": "previous"
                })
            
            return {
                "success": True,
                "images": formatted_images,
                "count": len(formatted_images)
            }
            
        except Exception as e:
            logger.error(f"Error retrieving previous images: {e}")
            return {
                "success": False,
                "error": str(e),
                "images": []
            }
    
    return previous_user_view