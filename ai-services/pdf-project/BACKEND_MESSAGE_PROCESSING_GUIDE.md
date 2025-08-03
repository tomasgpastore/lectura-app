# Backend Message Processing Guide

This guide explains how to retrieve conversation messages and process source references for the frontend.

## Overview

With the new source reference system, AI messages no longer contain duplicate source data. Instead, they contain references (IDs) to tool messages that contain the actual source data.

## Message Structure

### Human Message
```json
{
  "type": "human",
  "content": "What is machine learning?",
  "id": "msg_123",
  ...
}
```

### AI Message with Sources
```json
{
  "type": "ai",
  "content": "Machine learning is...",
  "id": "msg_456",
  "rag_source_ids": ["tool_msg_789"],
  "web_source_ids": ["tool_msg_012"],
  "image_source_ids": ["tool_msg_345"],
  ...
}
```

### Tool Message
```json
{
  "type": "tool",
  "id": "tool_msg_789",
  "name": "rag_search_tool",
  "content": "{\"success\": true, \"results\": [...]}",
  ...
}
```

## Implementation Guide

### 1. Retrieve Messages from MongoDB

```python
from pymongo import MongoClient
import json
from typing import List, Dict, Any, Optional

class MessageProcessor:
    def __init__(self, mongo_uri: str, db_name: str, collection_name: str):
        self.client = MongoClient(mongo_uri)
        self.db = self.client[db_name]
        self.collection = self.db[collection_name]
    
    def get_conversation_messages(self, user_id: str, course_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve conversation messages for frontend display.
        
        Args:
            user_id: User identifier
            course_id: Course identifier
            
        Returns:
            List of processed messages ready for frontend
        """
        thread_id = f"{user_id}:{course_id}"
        
        # Get the conversation document
        doc = self.collection.find_one({"thread_id": thread_id})
        if not doc or "messages" not in doc:
            return []
        
        all_messages = doc["messages"]
        processed_messages = []
        
        # Create a map of all messages by ID for quick lookup
        message_map = {msg.get("id"): msg for msg in all_messages if msg.get("id")}
        
        for msg in all_messages:
            msg_type = msg.get("type")
            
            # Only process human and ai messages
            if msg_type == "human":
                processed_messages.append(self._process_human_message(msg))
            
            elif msg_type == "ai":
                # Skip AI messages with empty content (tool calls)
                content = msg.get("content", "")
                if not content or content.strip() == "":
                    continue
                
                # Process AI message with sources
                processed_msg = self._process_ai_message(msg, message_map)
                processed_messages.append(processed_msg)
        
        return processed_messages
```

### 2. Process Messages

```python
    def _process_human_message(self, msg: Dict[str, Any]) -> Dict[str, Any]:
        """Process a human message for frontend."""
        return {
            "type": "human",
            "content": msg.get("content", ""),
            "id": msg.get("id"),
            "timestamp": msg.get("timestamp")  # Add if available
        }
    
    def _process_ai_message(self, msg: Dict[str, Any], message_map: Dict[str, Dict]) -> Dict[str, Any]:
        """Process an AI message and resolve source references."""
        processed = {
            "type": "ai",
            "content": msg.get("content", ""),
            "id": msg.get("id"),
            "timestamp": msg.get("timestamp"),  # Add if available
            "sources": {
                "rag": [],
                "web": [],
                "image": []
            }
        }
        
        # Process RAG sources
        rag_source_ids = msg.get("rag_source_ids", [])
        for source_id in rag_source_ids:
            if source_id in message_map:
                tool_msg = message_map[source_id]
                sources = self._parse_tool_message(tool_msg)
                processed["sources"]["rag"].extend(sources)
        
        # Process Web sources
        web_source_ids = msg.get("web_source_ids", [])
        for source_id in web_source_ids:
            if source_id in message_map:
                tool_msg = message_map[source_id]
                sources = self._parse_tool_message(tool_msg)
                processed["sources"]["web"].extend(sources)
        
        # Process Image sources
        image_source_ids = msg.get("image_source_ids", [])
        for source_id in image_source_ids:
            if source_id in message_map:
                tool_msg = message_map[source_id]
                sources = self._parse_tool_message(tool_msg)
                processed["sources"]["image"].extend(sources)
        
        return processed
```

### 3. Parse Tool Messages

```python
    def _parse_tool_message(self, tool_msg: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Parse tool message content to extract sources.
        
        Args:
            tool_msg: The tool message containing source data
            
        Returns:
            List of parsed sources
        """
        tool_name = tool_msg.get("name", "")
        content = tool_msg.get("content", "")
        
        # Parse JSON content
        try:
            if isinstance(content, str):
                data = json.loads(content)
            else:
                data = content
        except json.JSONDecodeError:
            return []
        
        # Check if the tool call was successful
        if not data.get("success", False):
            return []
        
        sources = []
        
        if tool_name == "rag_search_tool":
            # Parse RAG sources
            for result in data.get("results", []):
                sources.append({
                    "id": result.get("id"),
                    "slide": result.get("slide"),
                    "s3file": result.get("s3file"),
                    "start": result.get("start"),
                    "end": result.get("end"),
                    "text": result.get("text"),
                    "score": result.get("score", 0.0)
                })
        
        elif tool_name == "web_search_tool":
            # Parse Web sources
            for result in data.get("results", []):
                sources.append({
                    "id": result.get("id"),
                    "title": result.get("title"),
                    "url": result.get("url"),
                    "text": result.get("text"),
                    "score": result.get("score", 0.0)
                })
        
        elif tool_name == "current_user_view":
            # Parse current image analysis
            sources.append({
                "type": "current",
                "query": data.get("query"),
                "analysis": data.get("analysis"),
                "description": data.get("description", "Analysis of the current user's image")
            })
        
        elif tool_name == "previous_user_view":
            # Parse previous image analysis
            sources.append({
                "type": "previous",
                "message_id": data.get("message_id"),
                "query": data.get("query"),
                "analysis": data.get("analysis"),
                "timestamp": data.get("timestamp"),
                "description": data.get("description", "Analysis of a previous image")
            })
        
        return sources
```

### 4. Complete Example Usage

```python
# Initialize the processor
processor = MessageProcessor(
    mongo_uri="mongodb://localhost:27017/",
    db_name="your_db_name",
    collection_name="agent_states"
)

# Get messages for a user in a course
messages = processor.get_conversation_messages(
    user_id="user123",
    course_id="course456"
)

# Example output structure
"""
[
    {
        "type": "human",
        "content": "What is machine learning?",
        "id": "msg_123",
        "timestamp": "2024-01-01T10:00:00Z"
    },
    {
        "type": "ai",
        "content": "Machine learning is a subset of artificial intelligence...",
        "id": "msg_456",
        "timestamp": "2024-01-01T10:00:05Z",
        "sources": {
            "rag": [
                {
                    "id": "1",
                    "slide": "slide_789",
                    "s3file": "path/to/file.pdf",
                    "start": "1",
                    "end": "3",
                    "text": "Machine learning is defined as...",
                    "score": 0.95
                }
            ],
            "web": [
                {
                    "id": "1",
                    "title": "Introduction to ML",
                    "url": "https://example.com/ml-intro",
                    "text": "A comprehensive guide to machine learning...",
                    "score": 0.88
                }
            ],
            "image": []
        }
    }
]
"""
```

### 5. Error Handling and Edge Cases

```python
    def _parse_tool_message_safe(self, tool_msg: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Safe version with comprehensive error handling."""
        try:
            sources = self._parse_tool_message(tool_msg)
            return sources
        except Exception as e:
            # Log the error
            print(f"Error parsing tool message {tool_msg.get('id')}: {e}")
            return []
    
    def get_conversation_messages_safe(self, user_id: str, course_id: str) -> List[Dict[str, Any]]:
        """Safe version that handles all edge cases."""
        try:
            messages = self.get_conversation_messages(user_id, course_id)
            return messages
        except Exception as e:
            # Log the error
            print(f"Error retrieving messages for {user_id}:{course_id}: {e}")
            return []
```

## Key Points to Remember

1. **Filter Message Types**: Only return `human` and `ai` messages to the frontend
2. **Skip Empty AI Messages**: AI messages with empty content are tool calls, skip them
3. **Resolve References**: For each source ID in an AI message, find the corresponding tool message
4. **Parse Tool Content**: Tool messages contain JSON strings that need to be parsed
5. **Handle Errors**: Always handle JSON parsing errors and missing references gracefully
6. **Maintain Order**: Preserve the original message order for proper conversation flow

## Performance Optimization

For better performance with large conversations:

```python
def get_recent_messages(self, user_id: str, course_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Get only recent messages to improve performance."""
    thread_id = f"{user_id}:{course_id}"
    
    # Use MongoDB projection to get only recent messages
    doc = self.collection.find_one(
        {"thread_id": thread_id},
        {"messages": {"$slice": -limit * 2}}  # Get more to account for tool messages
    )
    
    # Process as before...
```

## Testing the Implementation

```python
# Test with a known conversation
if __name__ == "__main__":
    processor = MessageProcessor(
        mongo_uri=os.getenv("MONGO_URI"),
        db_name=os.getenv("MONGO_DB"),
        collection_name="agent_states"
    )
    
    messages = processor.get_conversation_messages("test_user", "test_course")
    
    for msg in messages:
        print(f"\n{msg['type'].upper()} Message:")
        print(f"Content: {msg['content'][:100]}...")
        if msg['type'] == 'ai' and msg.get('sources'):
            print("Sources:")
            for source_type, sources in msg['sources'].items():
                if sources:
                    print(f"  {source_type}: {len(sources)} sources")
```