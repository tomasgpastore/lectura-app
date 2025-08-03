# AI Message State Structure

## Overview

This document describes how AI messages are stored in the state when they contain image sources (when the agent cites `[^Page]`).

## AI Message Structure in MongoDB/Redis

When an AI message uses an image source, it's stored with the following structure:

```json
{
  "type": "ai",
  "content": "Based on the image [^Page], I can see that...",
  "id": "msg-uuid-12345",
  "rag_source_ids": ["tool-msg-1", "tool-msg-2"],
  "web_source_ids": ["tool-msg-3"],
  "image_source": {
    "s3key": "snapshots/slide-123/page-42.png",
    "slide_id": "slide-123",
    "page_number": 42
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Key Fields for Image Sources

When the agent uses `[^Page]` citation, the `image_source` object contains:

1. **s3key**: The S3 key for the snapshot
   - Used to generate presigned URLs later
   - Example: `"snapshots/slide-123/page-42.png"`

2. **slide_id**: The slide identifier
   - Matches the slideId from the snapshot
   - Example: `"slide-123"`

3. **page_number**: The page number
   - Integer value of the page
   - Example: `42`

## How It's Used

### Storing (When AI responds)
```python
sources_data = {
    message_id: {
        "rag_source_ids": [...],
        "web_source_ids": [...],
        "s3key": snapshot.get("s3key"),
        "slide_id": snapshot.get("slide_id"),
        "page_number": snapshot.get("page_number"),
        "timestamp": "2024-01-15T10:30:00Z"
    }
}
```

### Retrieving (For message history)
The backend can:
1. Find AI messages with `image_source` object
2. Extract `slide_id` and `page_number` from `image_source`
3. Use `s3key` to regenerate presigned URLs if needed
4. Show which images were referenced in previous responses

## Example Query Flow

1. **User sends**: Query + Snapshot (slide-123, page 42)
2. **Agent responds**: "Looking at [^Page], I can see..."
3. **Stored in state**:
   ```json
   {
     "type": "ai",
     "content": "Looking at [^Page], I can see...",
     "image_source": {
       "s3key": "snapshots/slide-123/page-42.png",
       "slide_id": "slide-123",
       "page_number": 42
     }
   }
   ```
4. **Backend can retrieve**: Both the response and the exact image reference

## Benefits

- **Complete traceability**: Know exactly which image was cited
- **Easy retrieval**: Can regenerate presigned URLs from s3key
- **Frontend display**: Has slideId and pageNumber for navigation
- **Persistent reference**: Image metadata stored with the message