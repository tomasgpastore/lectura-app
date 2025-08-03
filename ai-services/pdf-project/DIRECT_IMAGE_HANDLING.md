# Direct Image Handling in Agent

## Overview

This document describes the changes made to simplify image handling by removing the image view tools and sending images directly to the agent.

## Changes Made

### 1. Removed Image View Tools

**Before**: 
- `current_user_view` tool to analyze current snapshots
- `previous_user_view` tool to access previous snapshots
- Agent had to call tools to analyze images

**After**:
- Images are sent directly in multimodal messages
- Agent analyzes images without tool calls
- Simplified architecture and reduced latency

### 2. Multimodal Message Format

When a snapshot is provided, the user message is constructed as:
```python
user_message = HumanMessage(content=[
    {"type": "text", "text": user_prompt},
    {"type": "image_url", "image_url": snapshot_data['presigned_url']}
])
```

### 3. Citation Format Change

- **Before**: `[^Current Page]` and `[^Previous Page]`
- **After**: `[^Page]` for all image citations

### 4. Image Sources

When a snapshot is provided, an image source is automatically added:
```python
image_sources.append(ImageSource(
    id="page",
    type="current",
    slide_id=snapshot.get("slide_id"),
    page_number=snapshot.get("page_number")
))
```

## Benefits

1. **Simplified Architecture**: No need for separate image analysis tools
2. **Better Performance**: Direct image analysis without tool call overhead
3. **Cleaner Code**: Removed ~200 lines of image tool code
4. **Consistent Behavior**: Agent always has direct access to images

## Updated Prompts

The agent prompts now include:
```
IMPORTANT: The user has provided a snapshot of course material with their question. 
The image has been included in your message for direct analysis.
When citing information from the snapshot, use [^Page] as the citation.
```

## Rationale

Since users only send snapshots when they're actually needed (not with every query), it makes sense to:
- Give the agent direct access to analyze them
- Avoid the complexity of tool calls
- Reduce latency and improve user experience

## Testing

To verify the changes:
1. Send a query with a snapshot
2. Verify the agent can see and analyze the image directly
3. Check that `[^Page]` citations are used
4. Confirm image sources include slide_id and page_number