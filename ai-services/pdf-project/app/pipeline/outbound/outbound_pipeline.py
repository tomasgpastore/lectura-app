"""
Outbound pipeline for processing user queries with the intelligent agent.
Integrates with the new agent system that supports RAG, web search, and multimodal inputs.
"""

import logging
import time
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.pipeline.outbound.agent import process_agent_query, SearchType

# Configure logging
logger = logging.getLogger(__name__)


# Request/Response Models
class SnapshotData(BaseModel):
    """Snapshot data from backend."""
    slide_id: str = Field(..., description="Slide identifier")
    page_number: int = Field(..., description="Page number in the slide") 
    s3key: str = Field(..., description="S3 key for the image")


class OutboundRequest(BaseModel):
    """Request model for outbound pipeline matching backend format."""
    user_id: str = Field(..., description="User ID")
    course_id: str = Field(..., description="Course ID")
    user_prompt: str = Field(..., description="User's question")
    snapshot: Optional[SnapshotData] = Field(None, description="Snapshot data with S3 reference")
    slide_priority: List[str] = Field(default_factory=list, description="Slide IDs to prioritize")
    search_type: str = Field(..., description="Search type: DEFAULT, RAG, WEB, or RAG_WEB")


class RagSource(BaseModel):
    """RAG source information for citations."""
    id: str
    slide: str
    s3file: str
    start: str
    end: str
    text: str


class WebSource(BaseModel):
    """Web source information for citations."""
    id: str
    title: str
    url: str
    text: str


class ImageSource(BaseModel):
    """Image source information for citations."""
    id: str
    type: str  # "current" or "previous"
    messageId: Optional[str] = None  # For previous images (camelCase for frontend)
    timestamp: Optional[str] = None
    slideId: Optional[str] = None  # Slide identifier (camelCase for frontend)
    pageNumber: Optional[int] = None  # Page number (camelCase for frontend)


class ChatResponseDTO(BaseModel):
    """Response model matching expected backend format."""
    response: str = Field(..., description="The AI agent's response")
    ragSources: List[RagSource] = Field(default_factory=list, description="RAG sources used")
    webSources: List[WebSource] = Field(default_factory=list, description="Web sources used")
    imageSources: List[ImageSource] = Field(default_factory=list, description="Image sources used")


async def process_outbound_pipeline(request: OutboundRequest) -> ChatResponseDTO:
    """
    Process user query through the intelligent agent.
    
    Args:
        request: OutboundRequest containing user query and metadata
        
    Returns:
        ChatResponseDTO with agent response and sources
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing outbound request for user: {request.user_id}, course: {request.course_id}")
        logger.info(f"Search type: {request.search_type}, Slides priority: {request.slide_priority}")
        logger.info(f"Has snapshot: {request.snapshot is not None}")
        if request.snapshot:
            logger.info(f"Snapshot data: slide_id={request.snapshot.slide_id}, page={request.snapshot.page_number}, s3key={request.snapshot.s3key}")
        
        # Convert search type to uppercase to match enum
        search_type = request.search_type.upper()
        
        # Validate search type
        valid_types = ["DEFAULT", "RAG", "WEB", "RAG_WEB"]
        if search_type not in valid_types:
            logger.warning(f"Invalid search type '{search_type}', defaulting to DEFAULT")
            search_type = "DEFAULT"
        
        # Call the agent
        result = await process_agent_query(
            course_id=request.course_id,
            user_id=request.user_id,
            user_prompt=request.user_prompt,
            slides_priority=request.slide_priority,
            search_type=search_type,
            snapshot=request.snapshot.model_dump() if request.snapshot else None
        )
        
        # Convert result to response format
        response = ChatResponseDTO(
            response=result.get("response", ""),
            ragSources=[RagSource(**source) for source in result.get("rag_sources", [])],
            webSources=[WebSource(**source) for source in result.get("web_sources", [])],
            imageSources=[ImageSource(
                id=source["id"],
                type=source["type"],
                messageId=source.get("message_id"),
                timestamp=source.get("timestamp"),
                slideId=source.get("slide_id"),
                pageNumber=source.get("page_number")
            ) for source in result.get("image_sources", [])]
        )
        
        # Log performance metrics
        processing_time = time.time() - start_time
        logger.info(f"Outbound pipeline completed in {processing_time:.2f}s")
        logger.info(f"Response length: {len(response.response)} chars")
        logger.info(f"RAG sources: {len(response.ragSources)}, Web sources: {len(response.webSources)}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error in outbound pipeline: {str(e)}", exc_info=True)
        # Return error response
        return ChatResponseDTO(
            response=f"I encountered an error processing your request: {str(e)}",
            ragSources=[],
            webSources=[],
            imageSources=[]
        )


def cleanup_outbound_connections():
    """Clean up any connections used by the outbound pipeline."""
    from app.pipeline.outbound.agent import cleanup_agent_connections
    from app.pipeline.outbound.rag_retrieval import cleanup_rag_connections
    
    try:
        cleanup_agent_connections()
        cleanup_rag_connections()
        logger.info("Outbound pipeline connections cleaned up")
    except Exception as e:
        logger.error(f"Error cleaning up outbound connections: {e}")