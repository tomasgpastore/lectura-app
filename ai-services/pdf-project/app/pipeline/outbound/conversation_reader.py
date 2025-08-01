"""
Utility module for reading conversation history from MongoDB/Redis.
Provides functions to retrieve and format messages for frontend display.
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from pymongo import MongoClient, DESCENDING
import redis
from dotenv import load_dotenv

# Load environment variables
if not os.getenv('MONGO_URI'):
    load_dotenv()

logger = logging.getLogger(__name__)


class ConversationReader:
    """Reads conversation history from MongoDB and Redis."""
    
    def __init__(self):
        # MongoDB setup
        mongo_uri = os.getenv('MONGO_URI')
        if not mongo_uri:
            raise ValueError("MONGO_URI not found in environment")
        
        self.mongo_client = MongoClient(mongo_uri)
        db_name = os.getenv('MONGO_DB')
        if not db_name:
            raise ValueError("MONGO_DB not found in environment")
            
        self.mongo_db = self.mongo_client[db_name]
        self.states_collection = self.mongo_db[os.getenv('MONGO_STATES_COLLECTION', 'agent_states')]
        
        # Redis setup (optional - will use MongoDB as fallback)
        self.redis_client = None
        try:
            redis_url = os.getenv('UPSTASH_REDIS_REST_URL')
            redis_token = os.getenv('UPSTASH_REDIS_REST_TOKEN')
            
            if redis_url and redis_token:
                from upstash_redis import Redis
                self.redis_client = Redis(url=redis_url, token=redis_token)
                logger.info("Redis client initialized for reading")
            else:
                # Try local Redis
                redis_host = os.getenv('REDIS_HOST', 'localhost')
                redis_port = int(os.getenv('REDIS_PORT', '6379'))
                self.redis_client = redis.Redis(
                    host=redis_host,
                    port=redis_port,
                    decode_responses=True
                )
                logger.info("Local Redis client initialized")
        except Exception as e:
            logger.warning(f"Redis not available, will use MongoDB only: {e}")
    
    def get_thread_id(self, user_id: str, course_id: str) -> str:
        """Generate thread ID from user and course IDs."""
        return f"{user_id}:{course_id}"
    
    async def get_conversation_messages(
        self, 
        user_id: str, 
        course_id: str,
        limit: int = 50,
        include_sources: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get conversation messages formatted for frontend display.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            limit: Maximum number of messages to retrieve
            include_sources: Whether to include source information
            
        Returns:
            List of message objects sorted from newest to oldest
        """
        thread_id = self.get_thread_id(user_id, course_id)
        messages = []
        sources_by_message = {}
        
        # Try Redis first
        if self.redis_client:
            try:
                # Get messages from Redis
                redis_key = f"agent_state:{thread_id}"
                cached_data = self.redis_client.get(redis_key)
                
                if cached_data:
                    state_data = json.loads(cached_data)
                    raw_messages = state_data.get("messages", [])[-limit:]
                    
                    # Get sources if requested
                    if include_sources:
                        sources_key = f"agent_sources:{thread_id}"
                        all_sources = self.redis_client.hgetall(sources_key)
                        for msg_id, source_data in all_sources.items():
                            sources_by_message[msg_id] = json.loads(source_data)
                    
                    # Format messages
                    messages = self._format_messages_for_frontend(raw_messages, sources_by_message)
                    logger.info(f"Retrieved {len(messages)} messages from Redis")
                    return messages
                    
            except Exception as e:
                logger.warning(f"Error reading from Redis: {e}")
        
        # Fallback to MongoDB
        try:
            # Get conversation state
            doc = self.states_collection.find_one(
                {"thread_id": thread_id},
                {"messages": {"$slice": -limit}}
            )
            
            if doc and "messages" in doc:
                raw_messages = doc["messages"]
                
                # Format messages
                messages = self._format_messages_for_frontend(raw_messages, sources_by_message)
                logger.info(f"Retrieved {len(messages)} messages from MongoDB")
                
        except Exception as e:
            logger.error(f"Error reading from MongoDB: {e}")
        
        return messages
    
    def _format_messages_for_frontend(
        self, 
        raw_messages: List[Dict[str, Any]], 
        sources_by_message: Dict[str, Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Format raw messages for frontend display.
        
        Returns messages in newest-first order with formatted structure.
        """
        formatted_messages = []
        
        for i, msg in enumerate(raw_messages):
            msg_type = msg.get("type", "")
            content = msg.get("content", "")
            
            # Skip system and tool messages
            if msg_type in ["system", "tool"]:
                continue
            
            # Create formatted message
            formatted_msg = {
                "id": msg.get("id", f"msg_{i}"),
                "type": "user" if msg_type == "human" else "assistant",
                "content": content,
                "timestamp": msg.get("timestamp", datetime.utcnow().isoformat()),
                "sources": {
                    "ragSources": [],
                    "webSources": []
                }
            }
            
            # Add sources if available and this is an AI message
            if msg_type == "ai" and msg.get("id") in sources_by_message:
                source_data = sources_by_message[msg["id"]]
                formatted_msg["sources"]["ragSources"] = source_data.get("rag_sources", [])
                formatted_msg["sources"]["webSources"] = source_data.get("web_sources", [])
            
            formatted_messages.append(formatted_msg)
        
        # Reverse to get newest first
        formatted_messages.reverse()
        
        return formatted_messages
    
    async def get_all_conversations(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all conversations for a user across all courses.
        
        Returns:
            List of conversation summaries with course info and last message
        """
        conversations = []
        
        try:
            # Find all conversations for the user
            cursor = self.states_collection.find(
                {"user_id": user_id},
                {
                    "thread_id": 1,
                    "course_id": 1,
                    "updated_at": 1,
                    "message_count": 1,
                    "messages": {"$slice": -1}  # Get only last message
                }
            ).sort("updated_at", DESCENDING)
            
            for doc in cursor:
                # Get last message preview
                last_message = ""
                if doc.get("messages"):
                    last_msg = doc["messages"][-1]
                    if last_msg.get("type") in ["human", "ai"]:
                        last_message = last_msg.get("content", "")[:100] + "..."
                
                conversations.append({
                    "threadId": doc["thread_id"],
                    "courseId": doc["course_id"],
                    "lastMessage": last_message,
                    "messageCount": doc.get("message_count", 0),
                    "updatedAt": doc.get("updated_at", "")
                })
            
            logger.info(f"Found {len(conversations)} conversations for user {user_id}")
            
        except Exception as e:
            logger.error(f"Error getting conversations: {e}")
        
        return conversations
    
    async def sync_mongodb_to_redis(self, user_id: str, course_id: str) -> bool:
        """
        Sync conversation data from MongoDB to Redis for faster access.
        
        Returns:
            True if successful, False otherwise
        """
        if not self.redis_client:
            logger.warning("Redis client not available for sync")
            return False
        
        thread_id = self.get_thread_id(user_id, course_id)
        
        try:
            # Get data from MongoDB
            doc = self.states_collection.find_one({"thread_id": thread_id})
            
            if not doc:
                logger.info(f"No conversation found for thread {thread_id}")
                return False
            
            # Prepare data for Redis
            messages = doc.get("messages", [])
            state_data = {
                "messages": messages,
                "updated_at": doc.get("updated_at", datetime.utcnow().isoformat())
            }
            
            # Store in Redis with TTL
            redis_key = f"agent_state:{thread_id}"
            ttl = 3600 * 24  # 24 hours
            
            self.redis_client.setex(
                redis_key,
                ttl,
                json.dumps(state_data)
            )
            
            logger.info(f"Synced {len(messages)} messages to Redis for thread {thread_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error syncing to Redis: {e}")
            return False
    
    def close(self):
        """Close database connections."""
        if self.mongo_client:
            self.mongo_client.close()
        # Redis connections are handled automatically


# Convenience functions for direct usage
async def get_conversation_for_frontend(
    user_id: str, 
    course_id: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Get conversation messages formatted for frontend display.
    
    Example response:
    [
        {
            "id": "msg_123",
            "type": "user",
            "content": "What is machine learning?",
            "timestamp": "2024-01-01T12:00:00Z",
            "sources": {"ragSources": [], "webSources": []}
        },
        {
            "id": "msg_124", 
            "type": "assistant",
            "content": "Machine learning is...",
            "timestamp": "2024-01-01T12:00:30Z",
            "sources": {
                "ragSources": [...],
                "webSources": [...]
            }
        }
    ]
    """
    reader = ConversationReader()
    try:
        messages = await reader.get_conversation_messages(user_id, course_id, limit)
        return messages
    finally:
        reader.close()


async def get_user_conversations(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all conversations for a user.
    
    Example response:
    [
        {
            "threadId": "user123:course456",
            "courseId": "course456",
            "lastMessage": "Machine learning is...",
            "messageCount": 25,
            "updatedAt": "2024-01-01T12:00:30Z"
        }
    ]
    """
    reader = ConversationReader()
    try:
        conversations = await reader.get_all_conversations(user_id)
        return conversations
    finally:
        reader.close()