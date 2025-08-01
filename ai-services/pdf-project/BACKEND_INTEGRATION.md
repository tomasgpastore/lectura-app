# Backend Integration Guide

## 1. Outbound Endpoint Response Format

### Request Format
```json
POST /outbound
{
    "user_id": "user123",
    "course_id": "course-id-here",
    "user_prompt": "What is machine learning?",
    "search_type": "RAG",  // "DEFAULT" | "RAG" | "WEB" | "RAG_WEB"
    "slide_priority": ["slide-id-1", "slide-id-2"],  // Optional: prioritize specific slides
    "snapshots": ["base64-encoded-image"]             // Optional: multimodal input
}
```

### Response Format (ChatResponseDTO)
```json
{
    "response": "Machine learning is a subset of artificial intelligence...",
    "ragSources": [
        {
            "id": "1",
            "slide": "d2a9a46a-82e3-4d3c-9f11-7beed7c66aca",
            "s3file": "courses/7f36bacc-3b9d-4c50-9d66-a52f98dd12a9/slides/d2a9a46a-82e3-4d3c-9f11-7beed7c66aca.pdf",
            "start": "45",
            "end": "46",
            "text": "The actual text content from the PDF..."
        }
    ],
    "webSources": [
        {
            "id": "1",
            "title": "Introduction to Machine Learning - Wikipedia",
            "url": "https://en.wikipedia.org/wiki/Machine_learning",
            "text": "Machine learning (ML) is a field of study..."
        }
    ]
}
```

### TypeScript Types
```typescript
interface ChatResponseDTO {
    response: string;
    ragSources: RagSource[];
    webSources: WebSource[];
}

interface RagSource {
    id: string;
    slide: string;
    s3file: string;
    start: string;
    end: string;
    text: string;
}

interface WebSource {
    id: string;
    title: string;
    url: string;
    text: string;
}
```

## 2. Reading Conversation History

The AI service now manages conversation state in MongoDB and Redis. The backend should only READ from these stores.

### MongoDB Structure
- **Database**: Specified in `MONGO_DB` env variable
- **Collection**: `agent_states` (or specified in `MONGO_STATES_COLLECTION`)
- **Document Structure**:
```json
{
    "_id": "...",
    "thread_id": "user123:course456",
    "user_id": "user123",
    "course_id": "course456",
    "messages": [
        {
            "type": "human",
            "content": "What is AI?",
            "id": "msg_123",
            "timestamp": "2024-01-01T12:00:00Z"
        },
        {
            "type": "ai",
            "content": "AI stands for...",
            "id": "msg_124",
            "timestamp": "2024-01-01T12:00:30Z"
        }
    ],
    "updated_at": "2024-01-01T12:00:30Z",
    "message_count": 10
}
```

### Reading Messages for Frontend Display

#### Direct MongoDB Query (Java/Kotlin Example)
```kotlin
// Get conversation for a user and course
fun getConversationMessages(userId: String, courseId: String, limit: Int = 50): List<Message> {
    val threadId = "$userId:$courseId"
    
    val document = mongoCollection.findOne(
        Filters.eq("thread_id", threadId)
    )
    
    if (document != null) {
        val messages = document.getList("messages", Document::class.java)
            .takeLast(limit)
            .filter { msg -> 
                val type = msg.getString("type")
                type == "human" || type == "ai"
            }
            .map { msg ->
                Message(
                    id = msg.getString("id") ?: "",
                    type = if (msg.getString("type") == "human") "user" else "assistant",
                    content = msg.getString("content") ?: "",
                    timestamp = msg.getString("timestamp") ?: "",
                    sources = MessageSources() // Sources stored separately
                )
            }
            .reversed() // Newest first
        
        return messages
    }
    
    return emptyList()
}
```

### Redis Cache. When reading messages, always try redis first if not present then mongo and populate redis cache
- **Key Format**: `agent_state:{userId}:{courseId}`
- **Value**: JSON with messages array
- **TTL**: 24 hours

## 3. Message Format for Frontend

Messages should be formatted as:
```json
[
    {
        "id": "msg_125",
        "type": "assistant",
        "content": "The AI response text...",
        "timestamp": "2024-01-01T12:01:00Z",
        "sources": {
            "ragSources": [...],  // Same format as outbound response
            "webSources": [...]   // Same format as outbound response
        }
    },
    {
        "id": "msg_124",
        "type": "user",
        "content": "User's question",
        "timestamp": "2024-01-01T12:00:00Z",
        "sources": {
            "ragSources": [],
            "webSources": []
        }
    }
]
```

## 4. Source Storage

Sources are stored separately in Redis to optimize token usage:
- **Key**: `agent_sources:{userId}:{courseId}`
- **Type**: Hash
- **Fields**: Message IDs
- **Values**: JSON with `rag_sources` and `web_sources`

## 5. Implementation Steps

1. **Update Backend Message Saving**: Remove any code that saves to MongoDB/Redis for chat messages. The AI service handles this now.

2. **Add Message Reading**: Implement conversation reading using the above guide.

3. **Format for Frontend**: 
   - Convert messages to frontend format
   - Attach sources to assistant messages
   - Sort newest first

4. **Caching**: Because performance is needed, sync active conversations from MongoDB to Redis.


## 6. Important Notes

1. **No Message Saving**: The backend should NOT save messages anymore. The AI service handles all persistence.

2. **Thread ID Format**: Always use `{userId}:{courseId}` format for thread IDs.

3. **Message Types**: Filter for only "human" and "ai" message types when displaying to users.

4. **Source Citations**: The AI uses `[^n]` for RAG sources and `{^n}` for web sources in the response text.

5. **Conversation Continuity**: Each user-course pair maintains its own conversation history.

6. **Performance**: For active conversations, consider syncing from MongoDB to Redis for faster reads.