"""
Example endpoints for reading conversation history.
These can be added to your main backend or used as reference.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging

from app.pipeline.outbound.conversation_reader import (
    get_conversation_for_frontend,
    get_user_conversations,
    ConversationReader
)

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/conversations", tags=["conversations"])


# Request/Response Models
class ConversationRequest(BaseModel):
    userId: str
    courseId: str
    limit: Optional[int] = 50


class Message(BaseModel):
    id: str
    type: str  # "user" or "assistant"
    content: str
    timestamp: str
    sources: Dict[str, List[Dict[str, Any]]]


class ConversationSummary(BaseModel):
    threadId: str
    courseId: str
    lastMessage: str
    messageCount: int
    updatedAt: str


@router.post("/messages", response_model=List[Message])
async def get_conversation_messages(request: ConversationRequest):
    """
    Get conversation messages for a specific user and course.
    Messages are returned in newest-first order.
    
    Returns:
        List of messages with sources attached to assistant messages
    """
    try:
        messages = await get_conversation_for_frontend(
            user_id=request.userId,
            course_id=request.courseId,
            limit=request.limit
        )
        
        return messages
        
    except Exception as e:
        logger.error(f"Error getting conversation messages: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve conversation: {str(e)}"
        )


@router.get("/user/{user_id}", response_model=List[ConversationSummary])
async def get_all_user_conversations(user_id: str):
    """
    Get all conversations for a user across all courses.
    
    Returns:
        List of conversation summaries sorted by last update time
    """
    try:
        conversations = await get_user_conversations(user_id)
        return conversations
        
    except Exception as e:
        logger.error(f"Error getting user conversations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve conversations: {str(e)}"
        )


@router.post("/sync")
async def sync_conversation_to_cache(request: ConversationRequest):
    """
    Sync a conversation from MongoDB to Redis for faster access.
    
    This is optional but can improve performance for active conversations.
    """
    try:
        reader = ConversationReader()
        success = await reader.sync_mongodb_to_redis(
            user_id=request.userId,
            course_id=request.courseId
        )
        reader.close()
        
        if success:
            return {"status": "success", "message": "Conversation synced to cache"}
        else:
            return {"status": "failed", "message": "Could not sync conversation"}
            
    except Exception as e:
        logger.error(f"Error syncing conversation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync conversation: {str(e)}"
        )


# Example of how to add these to your main FastAPI app:
"""
from app.conversation_endpoints import router as conversation_router

app.include_router(conversation_router)
"""