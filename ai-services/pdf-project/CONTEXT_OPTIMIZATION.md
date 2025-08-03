# Context Optimization Solution

## Overview

This document describes the solution implemented to optimize context usage by truncating tool message content while preserving the ability to access previous sources.

## Problem

When loading conversation history for new queries:
- Tool messages contain full source content (10+ sources with full text)
- This wastes valuable context window space
- Previous sources are often irrelevant to new queries
- Increases API costs and slows performance

## Solution

### 1. Truncated Tool Messages in History

When loading conversation history, tool messages are modified to show:
- Tool name and success status
- Number of sources retrieved
- Message indicating full content is available via `retrieve_previous_sources`

Example of truncated tool message:
```json
{
  "success": true,
  "tool": "rag_search_tool",
  "result_count": 10,
  "message": "Retrieved 10 sources. Use retrieve_previous_sources to access full content."
}
```

### 2. Full Content Access on Demand

The `retrieve_previous_sources` tool now:
- Takes tool message IDs (not AI message IDs)
- Retrieves full tool message content from MongoDB
- Returns all sources with their unique IDs preserved

### 3. Agent Awareness

Agent prompts updated to explain:
- Tool content is truncated to save context
- How to access full content when needed
- Source IDs remain unique across tool calls

## Implementation Details

### State Manager Changes

```python
# New method to truncate tool messages
def _process_messages_for_history(self, messages_data):
    # Truncates tool message content
    # Preserves tool name and result count
    # Adds helpful message about retrieve_previous_sources

# New method to get full tool messages
async def get_tool_messages(self, user_id, course_id, tool_message_ids):
    # Retrieves full tool content from MongoDB
    # Returns parsed content with tool name
```

### Updated Tool

```python
@tool
async def retrieve_previous_sources(tool_message_ids: List[str]):
    """
    Retrieve sources from previous tool calls.
    Now takes tool message IDs instead of AI message IDs.
    """
```

### Preserved Features

1. **Citations still work**: Source IDs remain unique (1-20)
2. **Agent can access previous sources**: Using tool message IDs
3. **Full traceability**: All tool calls are recorded

## Benefits

1. **Reduced Context Usage**: ~90% reduction in context from tool messages
2. **Faster Processing**: Less tokens to process
3. **Lower Costs**: Fewer tokens = lower API costs
4. **Relevant Context**: Agent only retrieves sources when needed
5. **Backward Compatible**: Citations and source IDs unchanged

## Example Flow

1. **First Query**: "Tell me about machine learning"
   - Agent calls RAG tool, gets sources 1-10
   - Full response with citations

2. **Second Query**: "What is deep learning?"
   - History shows: `ToolMessage: Retrieved 10 sources. Use retrieve_previous_sources...`
   - Agent calls RAG tool, gets sources 11-20
   - If previous sources needed, calls `retrieve_previous_sources([tool_msg_id])`

## Testing

To verify the solution:
1. Make multiple queries requiring tool calls
2. Check that tool messages in history are truncated
3. Verify agent can retrieve full content when needed
4. Confirm citations remain unique and correct