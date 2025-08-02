"""
Agent state management system using Redis (primary) and MongoDB (backup).
Handles conversation history and state persistence for the outbound agent.
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import redis
from pymongo import MongoClient
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from dotenv import load_dotenv

# Load environment variables
if not os.getenv('MONGO_URI'):
    load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Global connections
_mongo_client: Optional[MongoClient] = None
_redis_client: Optional[redis.Redis] = None


def get_mongo_client() -> MongoClient:
    """Get or create MongoDB client (singleton)."""
    global _mongo_client
    if _mongo_client is None:
        mongo_uri = os.getenv('MONGO_URI')
        if not mongo_uri:
            raise ValueError("MONGO_URI not found in .env file")
        _mongo_client = MongoClient(mongo_uri)
        logger.info("MongoDB client initialized for agent state")
    return _mongo_client


def get_redis_client() -> redis.Redis:
    """Get or create Redis client (singleton)."""
    global _redis_client
    if _redis_client is None:
        redis_url = os.getenv('UPSTASH_REDIS_REST_URL')
        redis_token = os.getenv('UPSTASH_REDIS_REST_TOKEN')
        
        if redis_url and redis_token:
            # Use Upstash Redis if available
            from upstash_redis import Redis
            _redis_client = Redis(url=redis_url, token=redis_token)
            logger.info("Upstash Redis client initialized for agent state")
        else:
            # Fallback to local Redis
            redis_host = os.getenv('REDIS_HOST', 'localhost')
            redis_port = int(os.getenv('REDIS_PORT', '6379'))
            redis_db = int(os.getenv('REDIS_DB', '0'))
            _redis_client = redis.Redis(
                host=redis_host, 
                port=redis_port, 
                db=redis_db, 
                decode_responses=True
            )
            logger.info("Local Redis client initialized for agent state")
    return _redis_client


def serialize_message(message: BaseMessage, sources: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Convert a LangChain message to a serializable dictionary."""
    content = message.content
    
    # Strip image content from HumanMessage for storage efficiency
    if isinstance(message, HumanMessage) and isinstance(content, list):
        # Remove image_url entries from multimodal content
        filtered_content = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                filtered_content.append(item)
        # If only one text item remains, extract just the text
        if len(filtered_content) == 1:
            content = filtered_content[0]["text"]
        else:
            content = filtered_content if filtered_content else ""
    
    result = {
        "type": message.__class__.__name__.lower().replace("message", ""),
        "content": content,
        "additional_kwargs": getattr(message, "additional_kwargs", {}),
        "response_metadata": getattr(message, "response_metadata", {}),
        "id": getattr(message, "id", None),
        "name": getattr(message, "name", None),
        "tool_calls": getattr(message, "tool_calls", []),
        "tool_call_id": getattr(message, "tool_call_id", None),
    }
    
    # Add sources for AI messages if provided
    if isinstance(message, AIMessage) and sources:
        result["sources"] = sources
    
    return result


def deserialize_message(data: Dict[str, Any]) -> BaseMessage:
    """Convert a dictionary back to a LangChain message."""
    msg_type = data.get("type", "human")
    content = data.get("content", "")
    
    if msg_type == "human":
        return HumanMessage(
            content=content,
            additional_kwargs=data.get("additional_kwargs", {}),
            id=data.get("id"),
            name=data.get("name")
        )
    elif msg_type == "ai":
        return AIMessage(
            content=content,
            additional_kwargs=data.get("additional_kwargs", {}),
            response_metadata=data.get("response_metadata", {}),
            id=data.get("id"),
            name=data.get("name"),
            tool_calls=data.get("tool_calls", [])
        )
    elif msg_type == "system":
        return SystemMessage(
            content=content,
            additional_kwargs=data.get("additional_kwargs", {}),
            id=data.get("id"),
            name=data.get("name")
        )
    elif msg_type == "tool":
        return ToolMessage(
            content=content,
            tool_call_id=data.get("tool_call_id", ""),
            additional_kwargs=data.get("additional_kwargs", {}),
            id=data.get("id"),
            name=data.get("name")
        )
    else:
        # Default to HumanMessage
        return HumanMessage(content=content)


class AgentStateManager:
    """Manages agent state with Redis as primary and MongoDB as backup."""
    
    def __init__(self):
        self.mongo_client = get_mongo_client()
        self.redis_client = get_redis_client()
        
        # Get database and collection names from env
        db_name = os.getenv('MONGO_DB')
        collection_name = os.getenv('MONGO_STATES_COLLECTION', 'agent_states')
        
        if not db_name:
            raise ValueError("MONGO_DB must be set in .env")
        
        self.mongo_db = self.mongo_client[db_name]
        self.mongo_collection = self.mongo_db[collection_name]
        
        # Redis key prefixes
        self.redis_prefix = "agent_state:"
        self.redis_sources_prefix = "agent_sources:"
        self.redis_images_prefix = "agent_images:"
        self.redis_ttl = 3600 * 24  # 24 hours TTL for Redis cache
    
    def get_thread_id(self, user_id: str, course_id: str) -> str:
        """Generate thread ID from user and course IDs."""
        return f"{user_id}:{course_id}"
    
    async def get_conversation_history(
        self, 
        user_id: str, 
        course_id: str, 
        limit: int = 50
    ) -> List[BaseMessage]:
        """
        Get conversation history from Redis (if available) or MongoDB.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            limit: Maximum number of messages to retrieve
            
        Returns:
            List of LangChain messages
        """
        thread_id = self.get_thread_id(user_id, course_id)
        redis_key = f"{self.redis_prefix}{thread_id}"
        
        try:
            # Try Redis first
            cached_data = self.redis_client.get(redis_key)
            if cached_data:
                logger.info(f"Retrieved state from Redis for thread: {thread_id}")
                state_data = json.loads(cached_data)
                messages_data = state_data.get("messages", [])[-limit:]
                return [deserialize_message(msg) for msg in messages_data]
        except Exception as e:
            logger.warning(f"Error reading from Redis: {e}")
        
        # Fallback to MongoDB
        try:
            doc = self.mongo_collection.find_one(
                {"thread_id": thread_id},
                {"messages": {"$slice": -limit}}
            )
            
            if doc and "messages" in doc:
                logger.info(f"Retrieved state from MongoDB for thread: {thread_id}")
                messages_data = doc["messages"]
                messages = [deserialize_message(msg) for msg in messages_data]
                
                # Cache in Redis for next time
                try:
                    self.redis_client.setex(
                        redis_key,
                        self.redis_ttl,
                        json.dumps({"messages": messages_data})
                    )
                except Exception as e:
                    logger.warning(f"Error caching to Redis: {e}")
                
                return messages
            else:
                logger.info(f"No conversation history found for thread: {thread_id}")
                return []
                
        except Exception as e:
            logger.error(f"Error reading from MongoDB: {e}")
            return []
    
    async def save_messages(
        self, 
        user_id: str, 
        course_id: str, 
        messages: List[BaseMessage]
    ) -> bool:
        """
        Save messages to both Redis and MongoDB.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            messages: List of messages to save
            
        Returns:
            Success status
        """
        return await self.save_messages_with_sources(user_id, course_id, messages, None)
    
    async def save_messages_with_sources(
        self, 
        user_id: str, 
        course_id: str, 
        messages: List[BaseMessage],
        sources_map: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> bool:
        """
        Save messages to both Redis and MongoDB with optional sources.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            messages: List of messages to save
            sources_map: Optional map of message_id to sources
            
        Returns:
            Success status
        """
        thread_id = self.get_thread_id(user_id, course_id)
        redis_key = f"{self.redis_prefix}{thread_id}"
        
        # Serialize messages with sources
        serialized_messages = []
        for msg in messages:
            msg_id = getattr(msg, "id", None)
            sources = sources_map.get(msg_id) if sources_map and msg_id else None
            serialized_messages.append(serialize_message(msg, sources))
        
        state_data = {
            "thread_id": thread_id,
            "user_id": user_id,
            "course_id": course_id,
            "messages": serialized_messages,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "message_count": len(serialized_messages)
        }
        
        success = True
        
        # Save to MongoDB
        try:
            self.mongo_collection.update_one(
                {"thread_id": thread_id},
                {
                    "$set": state_data,
                    "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}
                },
                upsert=True
            )
            logger.info(f"Saved state to MongoDB for thread: {thread_id}")
        except Exception as e:
            logger.error(f"Error saving to MongoDB: {e}")
            success = False
        
        # Save to Redis
        try:
            self.redis_client.setex(
                redis_key,
                self.redis_ttl,
                json.dumps({"messages": serialized_messages})
            )
            logger.info(f"Saved state to Redis for thread: {thread_id}")
        except Exception as e:
            logger.warning(f"Error saving to Redis: {e}")
            # Don't fail if Redis save fails, MongoDB is the source of truth
        
        return success
    
    async def append_messages(
        self, 
        user_id: str, 
        course_id: str, 
        new_messages: List[BaseMessage],
        sources_map: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> bool:
        """
        Append new messages to existing conversation.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            new_messages: New messages to append
            sources_map: Optional map of message_id to sources
            
        Returns:
            Success status
        """
        # Get existing messages
        existing_messages = await self.get_conversation_history(user_id, course_id, limit=50)
        
        # Append new messages
        all_messages = existing_messages + new_messages
        
        # Keep only last 100 messages to prevent unbounded growth
        if len(all_messages) > 100:
            all_messages = all_messages[-100:]
        
        # Save all messages with sources
        return await self.save_messages_with_sources(user_id, course_id, all_messages, sources_map)
    
    async def clear_conversation(self, user_id: str, course_id: str) -> bool:
        """
        Clear conversation history for a specific thread.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            
        Returns:
            Success status
        """
        thread_id = self.get_thread_id(user_id, course_id)
        redis_key = f"{self.redis_prefix}{thread_id}"
        redis_sources_key = f"{self.redis_sources_prefix}{thread_id}"
        redis_images_key = f"{self.redis_images_prefix}{thread_id}"
        
        success = True
        
        # Clear from MongoDB
        try:
            self.mongo_collection.delete_one({"thread_id": thread_id})
            logger.info(f"Cleared state from MongoDB for thread: {thread_id}")
        except Exception as e:
            logger.error(f"Error clearing from MongoDB: {e}")
            success = False
        
        # Clear from Redis
        try:
            self.redis_client.delete(redis_key)
            self.redis_client.delete(redis_sources_key)
            self.redis_client.delete(redis_images_key)
            logger.info(f"Cleared state, sources, and images from Redis for thread: {thread_id}")
        except Exception as e:
            logger.warning(f"Error clearing from Redis: {e}")
        
        return success
    
    async def save_sources(
        self,
        user_id: str,
        course_id: str,
        message_id: str,
        rag_sources: List[Dict[str, Any]],
        web_sources: List[Dict[str, Any]]
    ) -> bool:
        """
        Save sources for a specific message to both MongoDB and Redis.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            message_id: Unique message identifier
            rag_sources: List of RAG sources
            web_sources: List of web sources
            
        Returns:
            Success status
        """
        thread_id = self.get_thread_id(user_id, course_id)
        redis_sources_key = f"{self.redis_sources_prefix}{thread_id}"
        
        sources_data = {
            "message_id": message_id,
            "rag_sources": rag_sources,
            "web_sources": web_sources,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        success = True
        
        # Save to MongoDB - update the message with its sources
        try:
            # Find the AI message with this ID and add sources to it
            self.mongo_collection.update_one(
                {
                    "thread_id": thread_id,
                    "messages.id": message_id
                },
                {
                    "$set": {
                        "messages.$.sources": sources_data
                    }
                }
            )
            logger.info(f"Saved sources to MongoDB for message {message_id} in thread {thread_id}")
        except Exception as e:
            logger.error(f"Error saving sources to MongoDB: {e}")
            success = False
        
        # Save to Redis as cache
        try:
            # Store in Redis hash with message_id as field
            self.redis_client.hset(
                redis_sources_key,
                message_id,
                json.dumps(sources_data)
            )
            # Set expiration
            self.redis_client.expire(redis_sources_key, self.redis_ttl)
            
            logger.info(f"Cached sources in Redis for message {message_id}")
        except Exception as e:
            logger.warning(f"Error caching sources in Redis: {e}")
            # Don't fail if Redis cache fails
            
        return success
    
    async def get_sources_for_messages(
        self,
        user_id: str,
        course_id: str,
        message_ids: List[str]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Retrieve sources for specific messages from Redis (cache) or MongoDB.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            message_ids: List of message IDs to retrieve sources for
            
        Returns:
            Dictionary mapping message_id to sources
        """
        thread_id = self.get_thread_id(user_id, course_id)
        redis_sources_key = f"{self.redis_sources_prefix}{thread_id}"
        
        sources_by_message = {}
        missing_ids = []
        
        # Try Redis first
        try:
            for message_id in message_ids:
                sources_data = self.redis_client.hget(redis_sources_key, message_id)
                if sources_data:
                    sources_by_message[message_id] = json.loads(sources_data)
                else:
                    missing_ids.append(message_id)
            
            if sources_by_message:
                logger.info(f"Retrieved {len(sources_by_message)} sources from Redis cache")
        except Exception as e:
            logger.warning(f"Error retrieving from Redis: {e}")
            missing_ids = message_ids
        
        # If we have missing IDs, try MongoDB
        if missing_ids:
            try:
                # Get the document with messages
                doc = self.mongo_collection.find_one(
                    {"thread_id": thread_id},
                    {"messages": 1}
                )
                
                if doc and "messages" in doc:
                    # Look for messages with sources
                    for msg in doc["messages"]:
                        if msg.get("id") in missing_ids and "sources" in msg:
                            sources_by_message[msg["id"]] = msg["sources"]
                            
                            # Cache in Redis for next time
                            try:
                                self.redis_client.hset(
                                    redis_sources_key,
                                    msg["id"],
                                    json.dumps(msg["sources"])
                                )
                            except Exception as e:
                                logger.warning(f"Error caching to Redis: {e}")
                    
                    logger.info(f"Retrieved {len(sources_by_message) - len(missing_ids)} additional sources from MongoDB")
                    
            except Exception as e:
                logger.error(f"Error retrieving from MongoDB: {e}")
        
        logger.info(f"Total sources retrieved: {len(sources_by_message)}")
        return sources_by_message
    
    async def get_all_sources(
        self,
        user_id: str,
        course_id: str
    ) -> List[Dict[str, Any]]:
        """
        Retrieve all sources for a thread.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            
        Returns:
            List of all sources in chronological order
        """
        thread_id = self.get_thread_id(user_id, course_id)
        redis_sources_key = f"{self.redis_sources_prefix}{thread_id}"
        
        all_sources = []
        
        try:
            # Get all sources from Redis
            sources_data = self.redis_client.hgetall(redis_sources_key)
            
            # Convert and sort by timestamp
            for message_id, data in sources_data.items():
                source_info = json.loads(data)
                source_info["message_id"] = message_id
                all_sources.append(source_info)
            
            # Sort by timestamp
            all_sources.sort(key=lambda x: x.get("timestamp", ""))
            
            logger.info(f"Retrieved {len(all_sources)} source sets for thread {thread_id}")
            return all_sources
            
        except Exception as e:
            logger.error(f"Error retrieving all sources: {e}")
            return []
    
    async def save_image(
        self,
        user_id: str,
        course_id: str,
        message_id: str,
        image: str
    ) -> bool:
        """
        Save an image for a specific message.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            message_id: Unique message identifier
            image: Base64 encoded image data
            
        Returns:
            Success status
        """
        thread_id = self.get_thread_id(user_id, course_id)
        redis_images_key = f"{self.redis_images_prefix}{thread_id}"
        
        image_data = {
            "message_id": message_id,
            "image": image,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            # Store in Redis hash with message_id as field
            self.redis_client.hset(
                redis_images_key,
                message_id,
                json.dumps(image_data)
            )
            # Set expiration
            self.redis_client.expire(redis_images_key, self.redis_ttl)
            
            logger.info(f"Saved image for message {message_id} in thread {thread_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving image: {e}")
            return False
    
    async def get_images_for_messages(
        self,
        user_id: str,
        course_id: str,
        message_ids: List[str]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Retrieve images for specific messages.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            message_ids: List of message IDs to retrieve images for
            
        Returns:
            Dictionary mapping message_id to image data
        """
        thread_id = self.get_thread_id(user_id, course_id)
        redis_images_key = f"{self.redis_images_prefix}{thread_id}"
        
        images_by_message = {}
        
        try:
            # Get images from Redis
            for message_id in message_ids:
                image_data = self.redis_client.hget(redis_images_key, message_id)
                if image_data:
                    images_by_message[message_id] = json.loads(image_data)
            
            logger.info(f"Retrieved images for {len(images_by_message)} messages")
            return images_by_message
            
        except Exception as e:
            logger.error(f"Error retrieving images: {e}")
            return {}


def cleanup_agent_state_connections():
    """Clean up database connections."""
    global _mongo_client, _redis_client
    
    if _mongo_client:
        _mongo_client.close()
        _mongo_client = None
    
    _redis_client = None
    
    logger.info("Agent state connections cleaned up")