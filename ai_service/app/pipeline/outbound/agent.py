"""
Intelligent agent for handling queries with RAG search, web search, or direct LLM responses.
Uses LangGraph for orchestration and manages conversation state.
"""

import os
import json
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, TypedDict, Optional, List, Dict, Any

# LangChain/LangGraph imports
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field

# Local imports
from app.pipeline.outbound.agent_state import AgentStateManager
from app.pipeline.outbound.agent_tools import (
    rag_search_tool,
    web_search_tool,
    create_retrieve_previous_sources_tool
)
from dotenv import load_dotenv

# Load environment variables
if not os.getenv('OPENAI_API_KEY'):
    load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Enums and Models
class SearchType(str, Enum):
    DEFAULT = "DEFAULT"
    RAG = "RAG"
    WEB = "WEB"
    RAG_WEB = "RAG_WEB"


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
    message_id: Optional[str] = None  # For previous images
    timestamp: Optional[str] = None
    slide_id: Optional[str] = None
    page_number: Optional[int] = None


class AgentResponse(BaseModel):
    """Final response format from the agent."""
    response: str
    rag_sources: List[RagSource] = Field(default_factory=list)
    web_sources: List[WebSource] = Field(default_factory=list)
    image_sources: List[ImageSource] = Field(default_factory=list)


# Graph State Definition
class GraphState(TypedDict):
    """State that flows through the agent graph."""
    messages: Annotated[list, add_messages]
    course_id: str
    user_id: str
    slides_priority: List[str]
    search_type: SearchType
    snapshot: Optional[Dict[str, Any]]
    rag_sources: List[Dict[str, Any]]
    web_sources: List[Dict[str, Any]]
    image_sources: List[Dict[str, Any]]
    final_response: Optional[str]
    sources_map: Optional[Dict[str, Dict[str, Any]]]
    rag_counter: int
    web_counter: int


class OutboundAgent:
    """Main agent class for handling queries with different search types."""
    
    def __init__(self):
        # Initialize Gemini 2.5 Flash
        google_api_key = os.getenv("GOOGLE_API_KEY")
        if not google_api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment")
        
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=google_api_key,
            temperature=0.3,
            max_output_tokens=4096,
            convert_system_message_to_human=True  # Gemini doesn't support system messages directly
        )
        
        # Initialize state manager
        self.state_manager = AgentStateManager()
        
        # Initialize with no specific user/course context
        self.user_id = None
        self.course_id = None
        self.retrieve_previous_sources_tool = None
    
    def _get_tools_for_search_type(self, search_type: SearchType) -> List:
        """Get the appropriate tools based on search type."""
        tools = []
        
        if search_type == SearchType.RAG:
            tools.append(rag_search_tool)
        elif search_type == SearchType.WEB:
            tools.append(web_search_tool)
        elif search_type == SearchType.RAG_WEB:
            tools.extend([rag_search_tool, web_search_tool])
        
        # Add retrieve_previous_sources if available
        if self.retrieve_previous_sources_tool:
            tools.append(self.retrieve_previous_sources_tool)
            
        return tools
    
    def _create_custom_tool_node(self, tools):
        """Create a custom tool node that maintains source counters."""
        base_tool_node = ToolNode(tools)
        
        async def custom_tool_node(state: GraphState, config: RunnableConfig) -> Dict[str, Any]:
            # Get current counters from state
            rag_counter = state.get("rag_counter", 0)
            web_counter = state.get("web_counter", 0)
            
            # Execute the tools normally
            result = await base_tool_node.ainvoke(state, config)
            
            # Process the tool messages to renumber sources
            messages = result.get("messages", [])
            for msg in messages:
                if isinstance(msg, ToolMessage):
                    try:
                        if msg.content and isinstance(msg.content, str):
                            tool_result = json.loads(msg.content)
                            
                            # Renumber RAG sources
                            if msg.name == "rag_search_tool" and tool_result.get("success"):
                                results = tool_result.get("results", [])
                                for source in results:
                                    rag_counter += 1
                                    source["id"] = str(rag_counter)
                                logger.info(f"Renumbered RAG sources: {len(results)} sources, IDs {rag_counter - len(results) + 1} to {rag_counter}")
                            
                            # Renumber Web sources
                            elif msg.name == "web_search_tool" and tool_result.get("success"):
                                results = tool_result.get("results", [])
                                for source in results:
                                    web_counter += 1
                                    source["id"] = str(web_counter)
                                logger.info(f"Renumbered Web sources: {len(results)} sources, IDs {web_counter - len(results) + 1} to {web_counter}")
                            
                            # Update the tool message content with renumbered sources
                            msg.content = json.dumps(tool_result)
                            
                    except Exception as e:
                        logger.error(f"Error processing tool result for renumbering: {e}")
            
            # Return updated messages and counters
            return {
                "messages": messages,
                "rag_counter": rag_counter,
                "web_counter": web_counter
            }
        
        return custom_tool_node
    
    def _build_graph(self, user_id: str, course_id: str, search_type: SearchType, snapshot: Optional[Dict[str, Any]] = None) -> StateGraph:
        """Build the LangGraph workflow with specific user/course context and search type."""
        # Create the retrieve_previous_sources tool with bound context
        self.user_id = user_id
        self.course_id = course_id
        self.retrieve_previous_sources_tool = create_retrieve_previous_sources_tool(
            self.state_manager, user_id, course_id
        )
        
        workflow = StateGraph(GraphState)
        
        # Add nodes
        workflow.add_node("agent", self._agent_node)
        
        # Get tools based on search type to restrict what can be executed
        allowed_tools = self._get_tools_for_search_type(search_type)
        
        # Create custom tool node with state awareness
        workflow.add_node("tools", self._create_custom_tool_node(allowed_tools))
        workflow.add_node("format_response", self._format_response_node)
        
        # Set entry point
        workflow.set_entry_point("agent")
        
        # Add edges
        workflow.add_conditional_edges(
            "agent",
            tools_condition,
            {
                "tools": "tools",
                END: "format_response"
            }
        )
        workflow.add_edge("tools", "agent")
        workflow.add_edge("format_response", END)
        
        return workflow
    
    async def _agent_node(self, state: GraphState, config: RunnableConfig) -> Dict[str, Any]:
        """Main agent logic node."""
        messages = state["messages"]
        search_type = state["search_type"]
        course_id = state["course_id"]
        slides_priority = state.get("slides_priority", [])
        snapshot = state.get("snapshot")
        
        # Get appropriate tools
        tools = self._get_tools_for_search_type(search_type)
        
        # Build system prompt based on search type
        system_prompt = self._build_system_prompt(search_type, course_id, slides_priority, has_snapshot=bool(snapshot))
        
        # Bind tools to LLM
        if tools:
            llm_with_tools = self.llm.bind_tools(tools)
        else:
            llm_with_tools = self.llm
        
        # Invoke LLM
        messages_with_system = [SystemMessage(content=system_prompt)] + messages
        response = await llm_with_tools.ainvoke(messages_with_system)
        
        # Extract sources from tool calls if any
        if hasattr(response, "tool_calls") and response.tool_calls:
            for tool_call in response.tool_calls:
                if tool_call["name"] == "rag_search_tool":
                    # RAG search will be executed by ToolNode
                    pass
                elif tool_call["name"] == "web_search_tool":
                    # Web search will be executed by ToolNode
                    pass
        
        return {"messages": [response]}
    
    def _build_system_prompt(self, search_type: SearchType, course_id: str, slides_priority: List[str], has_snapshot: bool = False) -> str:
        """Build the system prompt based on search type and context."""
        base_prompt = f"""You are an intelligent assistant helping students with course materials.
Course ID: {course_id}"""
        
        if slides_priority:
            base_prompt += f"\nPriority slides: {', '.join(slides_priority)}"
        
        # Add image information if snapshot is available
        if has_snapshot:
            base_prompt += """\n\nIMPORTANT: The user has provided a snapshot of course material with their question. 
The image has been included in your message for direct analysis.

CITATION RULES FOR IMAGES:
- You MUST cite [^Page] whenever you reference ANY information from the snapshot
- Place [^Page] immediately after mentioning content from the image
- Examples:
  - "The diagram shows three components [^Page]..."
  - "According to the formula on the slide [^Page]..."
  - "The image contains a flowchart [^Page] that illustrates..."
- ALWAYS cite [^Page] when discussing what you see in the image"""
        
        if search_type == SearchType.DEFAULT:
            return base_prompt + """
            
Answer the user's question based on your general knowledge. Be helpful and informative.

Available tools:
- retrieve_previous_sources: Access full source content from previous tool calls

IMPORTANT: To save context, tool message content is truncated in the conversation history. 
You can see which tools were called, but to access the full source content, use retrieve_previous_sources with the tool message IDs."""
        
        elif search_type == SearchType.RAG:
            return base_prompt + """
            
You MUST use the rag_search_tool to find relevant information from the course materials.
Steps:
1. Analyze if the question requires information from course materials or can be answered from conversation history
2. If new information is needed, create an optimized search query for vector search
3. Call rag_search_tool with the query
4. Answer based ONLY on the retrieved information
5. Cite sources using [^n] format where n is the source number. For multiple sources, use [^n][^m] format where n and m are the source numbers.
6. Place citations inline, not at the end
7. If a snapshot was provided, cite it as [^Page] whenever you reference it

IMPORTANT: To save context, tool message content is truncated in the conversation history.
- You can see which tools were called and how many sources were retrieved
- To access the full source content from previous queries, use retrieve_previous_sources with the tool message IDs
- Each tool call has unique source IDs that continue from previous calls (1-10, then 11-20, etc.)"""
        
        elif search_type == SearchType.WEB:
            return base_prompt + """
            
You MUST use the web_search_tool to find current information from the internet.
Steps:
1. Create an effective web search query
2. Call web_search_tool with the query
3. Answer based on the web results
4. Cite sources using {^n} format where n is the source number. For multiple sources, use {^n}{^m} format where n and m are the source numbers.
5. Place citations inline, not at the end
6. If a snapshot was provided, cite it as [^Page] whenever you reference it

IMPORTANT: To save context, tool message content is truncated in the conversation history.
- You can see which tools were called and how many sources were retrieved
- To access the full source content from previous queries, use retrieve_previous_sources with the tool message IDs
- Each tool call has unique source IDs that continue from previous calls (1-5, then 6-10, etc.)"""
        
        else:  # RAG_WEB
            return base_prompt + """
            
You have access to both course materials (rag_search_tool) and web search (web_search_tool).
Steps:
1. Determine what information is needed
2. Use rag_search_tool for course-specific information
3. Use web_search_tool for current events or supplementary information
4. Synthesize information from both sources
5. Cite RAG sources using [^n] and web sources using {^n}. For multiple sources, use [^n][^m] and {^n}{^m} respectively.
6. Place citations inline, not at the end
7. If a snapshot was provided, cite it as [^Page] whenever you reference it

IMPORTANT: To save context, tool message content is truncated in the conversation history.
- You can see which tools were called and how many sources were retrieved
- To access the full source content from previous queries, use retrieve_previous_sources with the tool message IDs
- Each tool call maintains unique source IDs (RAG: 1-10, then 11-20; Web: 1-5, then 6-10, etc.)"""
    
    async def _format_response_node(self, state: GraphState, config: RunnableConfig) -> Dict[str, Any]:
        """Format the final response with sources."""
        messages = state["messages"]
        rag_source_ids = []
        web_source_ids = []
        rag_sources = []
        web_sources = []
        image_sources = []
        
        # Extract the final AI message
        final_message = ""
        final_ai_msg_index = -1
        for i in range(len(messages) - 1, -1, -1):
            if isinstance(messages[i], AIMessage):
                final_message = messages[i].content
                final_ai_msg_index = i
                break
        
        # Find the last human message before the final AI message
        last_human_msg_index = -1
        for i in range(final_ai_msg_index - 1, -1, -1):
            if isinstance(messages[i], HumanMessage):
                last_human_msg_index = i
                break
        
        # Only process tool messages between the last human message and final AI message
        # This ensures we only get sources from the current query
        start_index = last_human_msg_index if last_human_msg_index >= 0 else 0
        
        # Collect IDs and sources from tool messages
        for i in range(start_index, len(messages)):
            msg = messages[i]
            if isinstance(msg, ToolMessage):
                try:
                    # Handle different content types
                    if not msg.content:
                        logger.warning(f"Empty content for tool message: {msg.name}")
                        continue
                    
                    tool_result = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                    
                    # Ensure the tool message has an ID
                    if not hasattr(msg, 'id') or not msg.id:
                        msg.id = str(uuid.uuid4())
                    
                    # Process RAG sources (already have unique IDs from custom tool node)
                    if msg.name == "rag_search_tool" and tool_result.get("success"):
                        rag_source_ids.append(msg.id)
                        logger.info(f"Added RAG source tool message ID: {msg.id}")
                        
                        # Extract sources - they already have unique IDs
                        for source in tool_result.get("results", []):
                            rag_sources.append(RagSource(
                                id=source["id"],  # Already unique from custom tool node
                                slide=source["slide"],
                                s3file=source["s3file"],
                                start=source["start"],
                                end=source["end"],
                                text=source["text"]
                            ))
                    
                    # Process Web sources (already have unique IDs from custom tool node)
                    elif msg.name == "web_search_tool" and tool_result.get("success"):
                        web_source_ids.append(msg.id)
                        logger.info(f"Added web source tool message ID: {msg.id}")
                        
                        # Extract sources - they already have unique IDs
                        for source in tool_result.get("results", []):
                            web_sources.append(WebSource(
                                id=source["id"],  # Already unique from custom tool node
                                title=source["title"],
                                url=source["url"],
                                text=source["text"]
                            ))
                    
                            
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error for tool {getattr(msg, 'name', 'unknown')}: {e}")
                    logger.error(f"Content type: {type(msg.content)}, Content: {msg.content[:200] if msg.content else 'None'}")
                except Exception as e:
                    logger.error(f"Error processing tool message {getattr(msg, 'name', 'unknown')}: {e}")
                    logger.error(f"Full error details: ", exc_info=True)
        
        # Find the final AI message and assign it an ID if it doesn't have one
        message_id = None
        if final_ai_msg_index >= 0:
            final_ai_msg = messages[final_ai_msg_index]
            if not hasattr(final_ai_msg, 'id') or not final_ai_msg.id:
                message_id = str(uuid.uuid4())
                final_ai_msg.id = message_id
            else:
                message_id = final_ai_msg.id
        
        # Check if snapshot was provided and add as image source
        if state.get("snapshot"):
            snapshot = state["snapshot"]
            image_sources.append(ImageSource(
                id="page",
                type="current",
                message_id=None,
                timestamp=datetime.now(timezone.utc).isoformat(),
                slide_id=snapshot.get("slide_id"),
                page_number=snapshot.get("page_number")
            ))
        
        # Store source message IDs in the state for later saving with the AI message
        sources_data = None
        if message_id and (rag_source_ids or web_source_ids or image_sources):
            sources_data = {
                message_id: {
                    "rag_source_ids": rag_source_ids,
                    "web_source_ids": web_source_ids,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
            # Add image source data if snapshot present
            if state.get("snapshot") and image_sources:
                snapshot = state["snapshot"]
                sources_data[message_id]["s3key"] = snapshot.get("s3key")
                sources_data[message_id]["slide_id"] = snapshot.get("slide_id")
                sources_data[message_id]["page_number"] = snapshot.get("page_number")
            logger.info(f"Sources data prepared for message {message_id}: RAG={len(rag_source_ids)}, Web={len(web_source_ids)}, Image={len(image_sources)}")
        
        return {
            "final_response": final_message,
            "rag_sources": [s.model_dump() for s in rag_sources],
            "web_sources": [s.model_dump() for s in web_sources],
            "image_sources": [s.model_dump() for s in image_sources],
            "sources_map": sources_data
        }
    
    async def process_query(
        self,
        course_id: str,
        user_id: str,
        user_prompt: str,
        slides_priority: List[str],
        search_type: SearchType,
        snapshot: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        """
        Process a user query through the agent.
        
        Args:
            course_id: Course identifier
            user_id: User identifier
            user_prompt: The user's question
            slides_priority: List of slide IDs to prioritize (can be empty)
            search_type: Type of search to perform
            snapshot: Optional screenshot in base64 (list with single element)
        
        Returns:
            AgentResponse with the answer and sources
        """
        try:
            # Process snapshot
            snapshot_data = None
            logger.info(f"Snapshot parameter received: {snapshot is not None}")
            if snapshot:
                logger.info(f"Snapshot data: slide_id={snapshot.get('slide_id')}, page={snapshot.get('page_number')}, s3key={snapshot.get('s3key')}")
                # Generate presigned URL for the snapshot
                from app.utils.s3_utils import generate_presigned_url
                presigned_url = generate_presigned_url(snapshot.get('s3key'))
                if presigned_url:
                    snapshot_data = {
                        'slide_id': snapshot.get('slide_id'),
                        'page_number': snapshot.get('page_number'),
                        's3key': snapshot.get('s3key'),
                        'presigned_url': presigned_url
                    }
                    logger.info(f"Generated presigned URL for snapshot")
            
            # Build graph with specific user/course context, search type, and snapshot
            self.graph = self._build_graph(user_id, course_id, search_type, snapshot_data).compile()
            
            # Get conversation history (will be stripped of images)
            history = await self.state_manager.get_conversation_history(user_id, course_id)
            
            # Note: We no longer save images in state manager since they're in S3
            # The snapshot data contains the S3 reference instead
            
            # Build user message with snapshot if available
            if snapshot_data and snapshot_data.get('presigned_url'):
                # Create multimodal message with image
                user_message = HumanMessage(content=[
                    {"type": "text", "text": user_prompt},
                    {"type": "image_url", "image_url": snapshot_data['presigned_url']}
                ])
                logger.info(f"Created multimodal message with snapshot for slide {snapshot_data.get('slide_id')}, page {snapshot_data.get('page_number')}")
            else:
                user_message = HumanMessage(content=user_prompt)
            
            # Build initial state
            initial_state = {
                "messages": history + [user_message],
                "course_id": course_id,
                "user_id": user_id,
                "slides_priority": slides_priority,
                "search_type": search_type,
                "snapshot": snapshot_data,
                "rag_sources": [],
                "web_sources": [],
                "image_sources": [],
                "final_response": None,
                "sources_map": None,
                "rag_counter": 0,
                "web_counter": 0
            }
            
            # Run the graph with recursion limit
            config = {
                "configurable": {"thread_id": f"{user_id}:{course_id}"},
                "recursion_limit": 10  # Prevent infinite loops
            }
            final_state = await self.graph.ainvoke(initial_state, config)
            
            # Save conversation history with sources
            await self.state_manager.append_messages(
                user_id, 
                course_id,
                [msg for msg in final_state["messages"] if msg not in history],
                final_state.get("sources_map")
            )
            
            # Build response with actual sources
            return AgentResponse(
                response=final_state.get("final_response", ""),
                rag_sources=[RagSource(**s) for s in final_state.get("rag_sources", [])],
                web_sources=[WebSource(**s) for s in final_state.get("web_sources", [])],
                image_sources=[ImageSource(**s) for s in final_state.get("image_sources", [])]
            )
            
        except Exception as e:
            logger.error(f"Error processing query: {e}")
            return AgentResponse(
                response=f"I encountered an error processing your request: {str(e)}",
                rag_sources=[],
                web_sources=[],
                image_sources=[]
            )


# Async wrapper for the agent
async def process_agent_query(
    course_id: str,
    user_id: str,
    user_prompt: str,
    slides_priority: List[str],
    search_type: str,
    snapshot: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Main entry point for processing queries through the agent.
    
    Returns:
        Dictionary with response and sources
    """
    # Convert search_type string to enum
    try:
        search_type_enum = SearchType(search_type)
    except ValueError:
        search_type_enum = SearchType.DEFAULT
    
    # Create agent instance
    agent = OutboundAgent()
    
    # Process query
    response = await agent.process_query(
        course_id=course_id,
        user_id=user_id,
        user_prompt=user_prompt,
        slides_priority=slides_priority,
        search_type=search_type_enum,
        snapshot=snapshot
    )
    
    return response.model_dump()


# Cleanup function
def cleanup_agent_connections():
    """Clean up agent connections."""
    from app.pipeline.outbound.agent_state import cleanup_agent_state_connections
    cleanup_agent_state_connections()
    logger.info("Agent connections cleaned up")