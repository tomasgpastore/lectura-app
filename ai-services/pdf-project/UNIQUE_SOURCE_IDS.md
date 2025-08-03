# Unique Source ID Solution

## Overview

This document describes the solution implemented to ensure unique source IDs across multiple tool calls in the AI agent system.

## Problem

When the agent calls the same tool multiple times (e.g., RAG search), each tool call returns sources with IDs like 1, 2, 3, etc. This creates duplicate IDs across different tool calls, making it impossible to determine which citation refers to which source.

## Solution

The solution uses a custom tool node that maintains running counters in the graph state. Sources are renumbered immediately after each tool call, ensuring the agent sees all sources with unique IDs.

### 1. RAG Sources
- **Strategy**: Use running counter (1, 2, 3... 10, then 11, 12, 13... 20)
- **First call**: Agent receives sources with IDs 1-10
- **Second call**: Agent receives sources with IDs 11-20 (continues from where it left off)
- **Citation format**: `[^1]`, `[^2]`, `[^11]`, `[^12]`, etc.

### 2. Web Sources  
- **Strategy**: Use running counter (1, 2, 3... 5, then 6, 7, 8... 10)
- **First call**: Agent receives sources with IDs 1-5
- **Second call**: Agent receives sources with IDs 6-10 (continues from where it left off)
- **Citation format**: `{^1}`, `{^2}`, `{^6}`, `{^7}`, etc.

### 3. Image Sources
- **Strategy**: Use composite IDs based on slide_page (e.g., "slide123_4")
- **For current images**: ID like "slide123_4" or "current" 
- **For previous images**: ID like "slide123_4" or "prev_messageId"
- **Citation format**: `[^Current Page]` or `[^Previous Page]`

## Implementation Details

### Custom Tool Node
A custom tool node wraps the standard LangChain ToolNode to:
1. Maintain counters in the graph state
2. Renumber sources immediately after tool execution
3. Return the modified tool results to the agent

### Code Structure
```python
# Graph state includes counters
class GraphState(TypedDict):
    rag_counter: int
    web_counter: int
    # ... other fields

# Custom tool node renumbers sources
async def custom_tool_node(state: GraphState, config: RunnableConfig):
    rag_counter = state.get("rag_counter", 0)
    web_counter = state.get("web_counter", 0)
    
    # Execute tools
    result = await base_tool_node.ainvoke(state, config)
    
    # Renumber sources in tool results
    for msg in messages:
        if msg.name == "rag_search_tool":
            for source in results:
                rag_counter += 1
                source["id"] = str(rag_counter)
```

### Data Flow

1. **Tool Execution**: Tool returns sources with IDs 1, 2, 3
2. **Custom Node Processing**: Renumbers to 11, 12, 13 (if counter was at 10)
3. **Agent Receives**: Sees sources with IDs 11, 12, 13
4. **Agent Cites**: Uses `[^11]`, `[^12]`, `[^13]` in response
5. **No Post-Processing Needed**: Citations are already correct

### Example

**First RAG tool call**:
- Tool returns: IDs 1, 2, 3
- Custom node renumbers: IDs 1, 2, 3 (counter starts at 0)
- Agent sees and cites: `[^1]`, `[^2]`, `[^3]`

**Second RAG tool call**:
- Tool returns: IDs 1, 2
- Custom node renumbers: IDs 4, 5 (counter continues from 3)
- Agent sees and cites: `[^4]`, `[^5]`

## Benefits
1. **Agent Awareness**: Agent sees all sources with unique IDs
2. **Correct Citations**: No post-processing needed, citations are correct from the start
3. **Full Traceability**: Each citation maps to exactly one source
4. **Simple Sequential**: Easy to understand and debug

## Testing

To test the solution:
1. Ask a question that requires multiple RAG searches
2. Check tool message contents show renumbered sources
3. Verify agent citations match the unique source IDs
4. Confirm no duplicate IDs exist across tool calls