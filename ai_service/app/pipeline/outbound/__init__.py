"""
Outbound pipeline module for processing user queries with intelligent agent.
"""

from .outbound_pipeline import (
    OutboundRequest,
    ChatResponseDTO,
    RagSource,
    WebSource,
    process_outbound_pipeline,
    cleanup_outbound_connections
)

from .agent import (
    SearchType,
    process_agent_query,
    cleanup_agent_connections
)

from .rag_retrieval import (
    retrieve_similar_chunks_async,
    cleanup_rag_connections
)

from .agent_state import (
    AgentStateManager,
    cleanup_agent_state_connections
)

__all__ = [
    # Pipeline functions
    "process_outbound_pipeline",
    "cleanup_outbound_connections",
    
    # Models
    "OutboundRequest",
    "ChatResponseDTO",
    "RagSource",
    "WebSource",
    "SearchType",
    
    # Agent functions
    "process_agent_query",
    "cleanup_agent_connections",
    
    # RAG functions
    "retrieve_similar_chunks_async",
    "cleanup_rag_connections",
    
    # State management
    "AgentStateManager",
    "cleanup_agent_state_connections"
] 