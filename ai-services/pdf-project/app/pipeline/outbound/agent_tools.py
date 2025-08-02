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
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

# Local imports
from app.pipeline.outbound.agent_state import AgentStateManager
from app.pipeline.outbound.rag_retrieval import retrieve_similar_chunks_async

# Configure logging
logger = logging.getLogger(__name__)


# Response Schemas
class ImageAnalysisResponse(BaseModel):
    """Schema for image analysis responses."""
    success: bool = Field(description="Whether the analysis was successful")
    query: str = Field(description="The query that was asked about the image")
    analysis: Optional[str] = Field(description="The analysis result from the vision model")
    error: Optional[str] = Field(default=None, description="Error message if analysis failed")
    
class CurrentImageResponse(ImageAnalysisResponse):
    """Response schema for current image analysis."""
    type: str = Field(default="current", description="Type of image analyzed")
    description: str = Field(default="Analysis of the current user's image")

class PreviousImageResponse(ImageAnalysisResponse):
    """Response schema for previous image analysis."""
    type: str = Field(default="previous", description="Type of image analyzed")
    message_id: str = Field(description="ID of the message containing the image")
    timestamp: Optional[str] = Field(default=None, description="Timestamp of the image")
    description: str = Field(default="Analysis of a previous image")


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


class VisionAgent:
    """Simple vision agent for analyzing images."""
    
    def __init__(self):
        google_api_key = os.getenv("GOOGLE_API_KEY")
        if not google_api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment")
        
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=google_api_key,
            temperature=0.3,
            max_output_tokens=1024
        )
    
    async def analyze_image(self, query: str, image_base64: str) -> str:
        """Analyze an image based on a query."""
        # Create multimodal message
        message = HumanMessage(content=[
            {"type": "text", "text": query},
            {"type": "image_url", "image_url": f"data:image/png;base64,{image_base64}"}
        ])
        
        # Get response from Gemini
        response = await self.llm.ainvoke([message])
        return response.content


def create_current_user_view_tool(snapshot: Optional[str]):
    """Create a current_user_view tool with bound snapshot."""
    
    # Create vision agent instance
    vision_agent = VisionAgent()
    
    @tool
    async def current_user_view(query: str) -> dict:
        """
        Analyze the user's current image based on a specific query.
        
        Args:
            query: What you want to know about the image (e.g., "What book is shown in this image?")
        
        Returns:
            Dictionary containing the analysis results
        """
        logger.info(f"Accessing current user view with query: {query}")
        
        if not snapshot:
            return CurrentImageResponse(
                success=False,
                query=query,
                analysis=None,
                error="No snapshot provided in current query"
            ).dict()
        
        try:
            # Use vision agent to analyze the image
            analysis = await vision_agent.analyze_image(query, snapshot)
            
            return CurrentImageResponse(
                success=True,
                query=query,
                analysis=analysis
            ).dict()
            
        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            return CurrentImageResponse(
                success=False,
                query=query,
                analysis=None,
                error=str(e)
            ).dict()
    
    return current_user_view


def create_previous_user_view_tool(state_manager: AgentStateManager, user_id: str, course_id: str):
    """Create a previous_user_view tool with bound context."""
    
    # Create vision agent instance
    vision_agent = VisionAgent()
    
    @tool
    async def previous_user_view(
        message_id: str,
        query: str
    ) -> dict:
        """
        Analyze an image from a previous message in the conversation.
        
        Args:
            message_id: The ID of the message containing the image
            query: What you want to know about that image
            
        Returns:
            Dictionary containing the analysis results
        """
        logger.info(f"Analyzing previous image from message {message_id} with query: {query}")
        
        try:
            # Retrieve the specific image
            images = await state_manager.get_images_for_messages(
                user_id=user_id,
                course_id=course_id,
                message_ids=[message_id]
            )
            
            if not images or message_id not in images:
                return PreviousImageResponse(
                    success=False,
                    query=query,
                    message_id=message_id,
                    analysis=None,
                    error=f"No image found for message ID: {message_id}"
                ).dict()
            
            # Get the image data
            image_data = images[message_id]
            image_base64 = image_data['image']
            
            # Use vision agent to analyze the image
            analysis = await vision_agent.analyze_image(query, image_base64)
            
            return PreviousImageResponse(
                success=True,
                message_id=message_id,
                query=query,
                analysis=analysis,
                timestamp=image_data.get("timestamp", "")
            ).dict()
            
        except Exception as e:
            logger.error(f"Error analyzing previous image: {e}")
            return PreviousImageResponse(
                success=False,
                query=query,
                message_id=message_id,
                analysis=None,
                error=str(e)
            ).dict()
    
    return previous_user_view