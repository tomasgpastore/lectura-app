"""
Intelligent agent for handling queries with RAG search, web search, or direct LLM responses.
Uses LangGraph for orchestration and manages conversation state.
"""

import os
import json
import logging
from enum import Enum
from typing import Annotated, TypedDict, Optional, List, Dict, Any

# LangChain/LangGraph imports
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field

# Local imports
from app.pipeline.outbound.agent_state import AgentStateManager
from app.pipeline.outbound.rag_retrieval import retrieve_similar_chunks_async
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


class AgentResponse(BaseModel):
    """Final response format from the agent."""
    response: str
    rag_sources: List[RagSource] = Field(default_factory=list)
    web_sources: List[WebSource] = Field(default_factory=list)


# Graph State Definition
class GraphState(TypedDict):
    """State that flows through the agent graph."""
    messages: Annotated[list, add_messages]
    course_id: str
    user_id: str
    slides_priority: List[str]
    search_type: SearchType
    snapshot: Optional[str]
    rag_sources: List[Dict[str, Any]]
    web_sources: List[Dict[str, Any]]
    final_response: Optional[str]


# Tool Definitions
def create_retrieve_previous_sources_tool(state_manager: AgentStateManager, user_id: str, course_id: str):
    """Create a retrieve_previous_sources tool with bound context."""
    
    @tool
    async def retrieve_previous_sources(
        message_ids: List[str]
    ) -> Dict[str, Any]:
        """
        Retrieve sources from previous messages in the conversation.
        
        Args:
            message_ids: List of message IDs to retrieve sources for
        
        Returns:
            Dictionary containing previous sources
        """
        logger.info(f"Retrieving previous sources for messages: {message_ids}")
        
        try:
            # Retrieve sources
            sources = await state_manager.get_sources_for_messages(
                user_id=user_id,
                course_id=course_id,
                message_ids=message_ids
            )
            
            # Flatten and combine all sources
            all_rag_sources = []
            all_web_sources = []
            
            for message_id, source_data in sources.items():
                rag_sources = source_data.get("rag_sources", [])
                web_sources = source_data.get("web_sources", [])
                
                # Add message_id to each source for reference
                for source in rag_sources:
                    source["from_message"] = message_id
                    all_rag_sources.append(source)
                
                for source in web_sources:
                    source["from_message"] = message_id
                    all_web_sources.append(source)
            
            return {
                "success": True,
                "rag_sources": all_rag_sources,
                "web_sources": all_web_sources,
                "message_count": len(sources)
            }
            
        except Exception as e:
            logger.error(f"Error retrieving previous sources: {e}")
            return {
                "success": False,
                "error": str(e),
                "rag_sources": [],
                "web_sources": []
            }
    
    return retrieve_previous_sources


@tool
async def rag_search_tool(
    query: str,
    course_id: str,
    slides_priority: List[str] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Search for relevant information in the course materials using RAG.
    
    Args:
        query: The search query optimized for vector search
        course_id: The course to search within
        slides_priority: Optional list of slide IDs to prioritize
        limit: Maximum number of results to return
    
    Returns:
        Dictionary containing search results and metadata
    """
    logger.info(f"RAG search - Query: '{query}', Course: {course_id}, Slides: {slides_priority}")
    
    try:
        # Use the real RAG retrieval function
        results = await retrieve_similar_chunks_async(
            course_id=course_id,
            slides=slides_priority or [],
            chunks=[],  # No chunk filtering
            prompt=query,
            limit=limit
        )
        
        # Format results for the agent
        formatted_results = []
        for i, result in enumerate(results, 1):
            metadata = result.get("metadata", {})
            formatted_results.append({
                "id": str(i),
                "slide": metadata.get("slideId", ""),
                "s3file": metadata.get("s3_path", ""),
                "start": str(metadata.get("pageStart", "")),
                "end": str(metadata.get("pageEnd", "")),
                "text": metadata.get("rawText", ""),
                "score": result.get("score", 0.0)
            })
        
        return {
            "success": True,
            "results": formatted_results,
            "count": len(formatted_results)
        }
        
    except Exception as e:
        logger.error(f"RAG search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "results": []
        }


@tool
def web_search_tool(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Search the web for current information using Tavily.
    
    Args:
        query: The search query
        max_results: Maximum number of results to return
    
    Returns:
        Dictionary containing web search results
    """
    logger.info(f"Web search - Query: '{query}'")
    
    try:
        # Initialize Tavily search
        tavily_api_key = os.getenv("TAVILY_API_KEY")
        if not tavily_api_key:
            raise ValueError("TAVILY_API_KEY not found in environment")
        
        search = TavilySearchResults(
            api_key=tavily_api_key,
            max_results=max_results
        )
        
        # Perform search
        results = search.invoke(query)
        
        # Format results
        formatted_results = []
        for i, result in enumerate(results, 1):
            formatted_results.append({
                "id": str(i),
                "title": result.get("title", ""),
                "url": result.get("url", ""),
                "text": result.get("content", ""),
                "score": result.get("score", 0.0)
            })
        
        return {
            "success": True,
            "results": formatted_results,
            "count": len(formatted_results)
        }
        
    except Exception as e:
        logger.error(f"Web search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "results": []
        }


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
    
    def _build_graph(self, user_id: str, course_id: str) -> StateGraph:
        """Build the LangGraph workflow with specific user/course context."""
        # Create the retrieve_previous_sources tool with bound context
        self.user_id = user_id
        self.course_id = course_id
        self.retrieve_previous_sources_tool = create_retrieve_previous_sources_tool(
            self.state_manager, user_id, course_id
        )
        
        workflow = StateGraph(GraphState)
        
        # Add nodes
        workflow.add_node("agent", self._agent_node)
        
        # Create tool node with all tools including the bound retrieve_previous_sources
        all_tools = [rag_search_tool, web_search_tool, self.retrieve_previous_sources_tool]
        workflow.add_node("tools", ToolNode(all_tools))
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
        system_prompt = self._build_system_prompt(search_type, course_id, slides_priority)
        
        # Add snapshot to the last message if provided
        if snapshot and messages:
            last_message = messages[-1]
            if isinstance(last_message, HumanMessage):
                # Create multimodal message with text and image for Gemini
                # Gemini expects the image as base64 string without data URI prefix
                content = [
                    {"type": "text", "text": last_message.content},
                    {"type": "image", "image": snapshot}  # Gemini format
                ]
                messages[-1] = HumanMessage(content=content)
        
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
    
    def _build_system_prompt(self, search_type: SearchType, course_id: str, slides_priority: List[str]) -> str:
        """Build the system prompt based on search type and context."""
        base_prompt = f"""You are an intelligent assistant helping students with course materials.
Course ID: {course_id}"""
        
        if slides_priority:
            base_prompt += f"\nPriority slides: {', '.join(slides_priority)}"
        
        if search_type == SearchType.DEFAULT:
            return base_prompt + """
            
Answer the user's question based on your general knowledge. Be helpful and informative.
You can use retrieve_previous_sources to access sources from earlier in the conversation if needed."""
        
        elif search_type == SearchType.RAG:
            return base_prompt + """
            
You MUST use the rag_search_tool to find relevant information from the course materials.
Steps:
1. Analyze if the question requires information from course materials or can be answered from conversation history
2. If new information is needed, create an optimized search query for vector search
3. Call rag_search_tool with the query
4. Answer based ONLY on the retrieved information
5. Cite sources using [^n] format where n is the source number
6. Place citations inline, not at the end

Note: You can use retrieve_previous_sources to access sources from earlier messages if needed."""
        
        elif search_type == SearchType.WEB:
            return base_prompt + """
            
You MUST use the web_search_tool to find current information from the internet.
Steps:
1. Create an effective web search query
2. Call web_search_tool with the query
3. Answer based on the web results
4. Cite sources using {^n} format where n is the source number
5. Place citations inline, not at the end

Note: You can use retrieve_previous_sources to access sources from earlier messages if needed."""
        
        else:  # RAG_WEB
            return base_prompt + """
            
You have access to both course materials (rag_search_tool) and web search (web_search_tool).
Steps:
1. Determine what information is needed
2. Use rag_search_tool for course-specific information
3. Use web_search_tool for current events or supplementary information
4. Synthesize information from both sources
5. Cite RAG sources using [^n] and web sources using {^n}
6. Place citations inline, not at the end

Note: You can use retrieve_previous_sources to access sources from earlier messages if needed."""
    
    async def _format_response_node(self, state: GraphState, config: RunnableConfig) -> Dict[str, Any]:
        """Format the final response with sources."""
        messages = state["messages"]
        rag_sources = []
        web_sources = []
        
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
        
        for i in range(start_index, len(messages)):
            msg = messages[i]
            if isinstance(msg, ToolMessage):
                try:
                    tool_result = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                    
                    if msg.name == "rag_search_tool" and tool_result.get("success"):
                        for source in tool_result.get("results", []):
                            rag_sources.append(RagSource(
                                id=source["id"],
                                slide=source["slide"],
                                s3file=source["s3file"],
                                start=source["start"],
                                end=source["end"],
                                text=source["text"]
                            ))
                    
                    elif msg.name == "web_search_tool" and tool_result.get("success"):
                        for source in tool_result.get("results", []):
                            web_sources.append(WebSource(
                                id=source["id"],
                                title=source["title"],
                                url=source["url"],
                                text=source["text"]
                            ))
                            
                except Exception as e:
                    logger.error(f"Error processing tool message: {e}")
        
        # Generate message ID for source storage
        import uuid
        message_id = str(uuid.uuid4())
        
        # Store sources separately (async)
        try:
            thread_id = config.get("configurable", {}).get("thread_id", "")
            if thread_id and ":" in thread_id:
                user_id, course_id = thread_id.split(":", 1)
                await self.state_manager.save_sources(
                    user_id=user_id,
                    course_id=course_id,
                    message_id=message_id,
                    rag_sources=[s.dict() for s in rag_sources],
                    web_sources=[s.dict() for s in web_sources]
                )
                logger.info(f"Saved sources for message {message_id}")
        except Exception as e:
            logger.error(f"Error saving sources: {e}")
        
        return {
            "final_response": final_message,
            "rag_sources": [s.dict() for s in rag_sources],
            "web_sources": [s.dict() for s in web_sources]
        }
    
    async def process_query(
        self,
        course_id: str,
        user_id: str,
        user_prompt: str,
        slides_priority: List[str],
        search_type: SearchType,
        snapshot: Optional[List[str]] = None
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
            # Build graph with specific user/course context
            self.graph = self._build_graph(user_id, course_id).compile()
            
            # Get conversation history
            history = await self.state_manager.get_conversation_history(user_id, course_id)
            
            # Process snapshot
            snapshot_b64 = None
            if snapshot and len(snapshot) > 0:
                snapshot_b64 = snapshot[0]
            
            # Build initial state
            initial_state = {
                "messages": history + [HumanMessage(content=user_prompt)],
                "course_id": course_id,
                "user_id": user_id,
                "slides_priority": slides_priority,
                "search_type": search_type,
                "snapshot": snapshot_b64,
                "rag_sources": [],
                "web_sources": [],
                "final_response": None
            }
            
            # Run the graph
            config = {"configurable": {"thread_id": f"{user_id}:{course_id}"}}
            final_state = await self.graph.ainvoke(initial_state, config)
            
            # Save conversation history
            await self.state_manager.append_messages(
                user_id, 
                course_id,
                [msg for msg in final_state["messages"] if msg not in history]
            )
            
            # Build response
            return AgentResponse(
                response=final_state.get("final_response", ""),
                rag_sources=[RagSource(**s) for s in final_state.get("rag_sources", [])],
                web_sources=[WebSource(**s) for s in final_state.get("web_sources", [])]
            )
            
        except Exception as e:
            logger.error(f"Error processing query: {e}")
            return AgentResponse(
                response=f"I encountered an error processing your request: {str(e)}",
                rag_sources=[],
                web_sources=[]
            )


# Async wrapper for the agent
async def process_agent_query(
    course_id: str,
    user_id: str,
    user_prompt: str,
    slides_priority: List[str],
    search_type: str,
    snapshot: Optional[List[str]] = None
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