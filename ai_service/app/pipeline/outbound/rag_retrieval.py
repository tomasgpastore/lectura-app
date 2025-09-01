"""
RAG Retrieval module for finding relevant chunks from MongoDB vector index.
Uses MongoDB Atlas Vector Search with direct Voyage API for 512-dimension embeddings.
"""

import os
import logging
from typing import List, Dict, Any, Optional
import voyageai
from pymongo import MongoClient
from dotenv import load_dotenv
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Load environment variables only if not already loaded
if not os.getenv('MONGO_URI'):
    load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Global connections
_mongo_client: Optional[MongoClient] = None
_voyage_client: Optional[voyageai.Client] = None
_thread_pool: Optional[ThreadPoolExecutor] = None


def get_thread_pool() -> ThreadPoolExecutor:
    """Get or create thread pool for CPU-bound operations"""
    global _thread_pool
    if _thread_pool is None:
        _thread_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="rag_retrieval_")
    return _thread_pool


def get_mongo_client() -> MongoClient:
    """Get or create MongoDB client (singleton)."""
    global _mongo_client
    if _mongo_client is None:
        mongo_uri = os.getenv('MONGO_URI')
        if not mongo_uri:
            raise ValueError("MONGO_URI not found in .env file")
        _mongo_client = MongoClient(mongo_uri)
        logger.info("MongoDB client initialized for RAG retrieval")
    return _mongo_client


def get_voyage_client() -> voyageai.Client:
    """Get or create Voyage client (singleton)."""
    global _voyage_client
    if _voyage_client is None:
        api_key = os.getenv('VOYAGE_API_KEY')
        if not api_key:
            raise ValueError("VOYAGE_API_KEY not found in .env file")
        _voyage_client = voyageai.Client(api_key=api_key)
        logger.info("Voyage client initialized for RAG retrieval")
    return _voyage_client


def embed_query(query: str) -> List[float]:
    """
    Embed a query string using Voyage 3.5-lite with 512 dimensions.
    
    Args:
        query: The query text to embed
    
    Returns:
        List of floats representing the embedding vector
    """
    client = get_voyage_client()
    model = "voyage-3.5-lite"
    dimensions = 512
    
    # Embed the query
    result = client.embed(
        texts=[query],
        model=model,
        input_type="query",  # Use "query" for search queries
        output_dimension=dimensions
    )
    
    return result.embeddings[0]


def retrieve_similar_chunks(
    course_id: str,
    slides: List[str],
    chunks: List[int],
    query_embedding: List[float],
    limit: int,
    mongo_client: Optional[MongoClient] = None
) -> List[Dict[str, Any]]:
    """
    Retrieve similar chunks from MongoDB using vector search with pre-filtering.
    
    The function returns the top K most similar chunks where:
    - course_id matches the provided course_id (required)
    - slide_id is in the slides list (if slides list is not empty)
    - chunk_index is in the chunks list (if chunks list is not empty)
    
    Note: MongoDB Atlas Vector Search applies filters BEFORE similarity search (pre-filtering),
    which is more efficient than post-retrieval filtering.
    
    Args:
        course_id: The course ID to filter by (required)
        slides: List of slide IDs to filter by (empty list = all slides from course)
        chunks: List of chunk indices to filter by (empty list = all chunks that match course/slides)
        query_embedding: The embedding vector to search with
        limit: Maximum number of results to return (top K)
        mongo_client: Optional MongoClient instance (creates new if not provided)
    
    Returns:
        List of up to 'limit' chunks sorted by similarity score
    """
    # Get MongoDB configuration
    db_name = os.getenv('MONGO_DB')
    collection_name = os.getenv('MONGO_COLLECTION_NAME')
    vector_index_name = os.getenv('MONGO_VECTOR_INDEX')
    num_candidates = int(os.getenv('MONGO_NUM_CANDIDATES', '10000'))  # Default to 10000 if not set
    
    if not all([db_name, collection_name, vector_index_name]):
        raise ValueError("MONGO_DB, MONGO_COLLECTION_NAME, and MONGO_VECTOR_INDEX must be set in .env")
    
    # Initialize MongoDB client if not provided
    if mongo_client is None:
        mongo_client = get_mongo_client()
    
    # Get database and collection
    db = mongo_client[db_name]
    collection = db[collection_name]
    
    # Build filter query - this is applied BEFORE vector search
    filter_query = {"course_id": course_id}
    
    # Add slide filter if slides list is not empty
    if slides:
        filter_query["slide_id"] = {"$in": slides}
    
    # Add chunk filter if chunks list is not empty
    if chunks:
        filter_query["chunk_index"] = {"$in": chunks}
    
    logger.info(f"Applying filter: {filter_query}")
    
    # Perform vector search using MongoDB Atlas Vector Search
    # The filter is applied as pre-filtering before similarity calculation
    # Note: numCandidates is configurable via MONGO_NUM_CANDIDATES env variable
    # This value determines the candidate pool size for the ANN algorithm.
    # Since pre-filtering limits the search space, set this high enough to
    # search through all relevant documents while maintaining good performance.
    pipeline = [
        {
            "$vectorSearch": {
                "index": vector_index_name,  # Use env variable for index name
                "path": "embedding",  # The field containing embeddings
                "queryVector": query_embedding,
                "numCandidates": num_candidates,  # Configurable via MONGO_NUM_CANDIDATES env var
                "limit": limit,
                "filter": filter_query  # Pre-filtering applied here
            }
        },
        {
            "$addFields": {
                "score": {"$meta": "vectorSearchScore"}  # Add similarity score to the document
            }
        }
    ]
    
    try:
        # Execute the aggregation pipeline
        results = list(collection.aggregate(pipeline))
        
        logger.info(f"Retrieved {len(results)} chunks from MongoDB for course {course_id}")
        
        # Format results to match expected structure
        formatted_results = []
        for doc in results:
            # Remove the embedding field to avoid sending large vectors
            doc.pop("embedding", None)
            
            # Create metadata dict with all fields from MongoDB
            formatted_chunk = {
                "id": doc.get("_id", ""),
                "metadata": {
                    "courseId": doc.get("course_id", ""),
                    "slideId": doc.get("slide_id", ""),
                    "chunkIndex": doc.get("chunk_index", 0),
                    "rawText": doc.get("text", ""),
                    "wordCount": doc.get("word_count", 0),
                    "charCount": doc.get("char_count", 0),
                    "splitLevel": doc.get("split_level", ""),
                    "pageStart": doc.get("page_start", 0),
                    "pageEnd": doc.get("page_end", 0),
                    "headersHierarchy": doc.get("headers_hierarchy", []),
                    "headersHierarchyTitles": doc.get("headers_hierarchy_titles", []),
                    "s3_path": doc.get("s3_file_name", ""),
                    "totalPages": doc.get("total_pages", 0),
                    "timestamp": doc.get("timestamp", 0),
                    "sentenceSiblingCount": doc.get("sentence_sibling_count", 0),
                    "sentenceSiblingIndex": doc.get("sentence_sibling_index", 0),
                    "updatedAt": doc.get("updated_at", 0),
                    # Optional fields
                    "isHeader": doc.get("is_header", False),
                    "headerLevel": doc.get("header_level", None),
                    "headerText": doc.get("header_text", None)
                },
                "score": doc.get("score", 0.0)
            }
            formatted_results.append(formatted_chunk)
        
        return formatted_results
        
    except Exception as e:
        logger.error(f"Error retrieving chunks from MongoDB: {str(e)}")
        raise


async def retrieve_similar_chunks_async(
    course_id: str,
    slides: List[str],
    chunks: List[int],
    prompt: str,
    limit: int
) -> List[Dict[str, Any]]:
    """
    Async wrapper for RAG retrieval that handles embedding and search.
    
    The function returns the top K most similar chunks where:
    - course_id matches the provided course_id (required)
    - slide_id is in the slides list (if slides list is not empty)
    - chunk_index is in the chunks list (if chunks list is not empty)
    
    Note: Filtering is done as pre-filtering in MongoDB before similarity search.
    
    Args:
        course_id: The course ID to filter by (required)
        slides: List of slide IDs to filter by (empty list = all slides from course)
        chunks: List of chunk indices to filter by (empty list = all chunks that match course/slides)
        prompt: The query text to search for
        limit: Maximum number of results to return (top K)
    
    Returns:
        List of up to 'limit' chunks sorted by similarity score
    """
    try:
        # Use thread pool for CPU-bound operations
        thread_pool = get_thread_pool()
        loop = asyncio.get_event_loop()
        
        # Step 1: Embed the query
        logger.info(f"Embedding query: '{prompt[:100]}...'")
        
        def _embed_query():
            return embed_query(prompt)
        
        query_embedding = await loop.run_in_executor(thread_pool, _embed_query)
        logger.info(f"Query embedded successfully (dimension: {len(query_embedding)})")
        
        # Step 2: Retrieve similar chunks with pre-filtering
        logger.info(f"Retrieving similar chunks from MongoDB with pre-filtering")
        
        def _retrieve_chunks():
            return retrieve_similar_chunks(
                course_id=course_id,
                slides=slides,
                chunks=chunks,
                query_embedding=query_embedding,
                limit=limit
            )
        
        results = await loop.run_in_executor(thread_pool, _retrieve_chunks)
        logger.info(f"Retrieved {len(results)} similar chunks")
        
        return results
        
    except Exception as e:
        logger.error(f"Error in async RAG retrieval: {str(e)}")
        raise


def cleanup_rag_connections():
    """Clean up connections on shutdown"""
    global _thread_pool, _mongo_client, _voyage_client
    
    if _thread_pool:
        _thread_pool.shutdown(wait=True)
        _thread_pool = None
    
    if _mongo_client:
        _mongo_client.close()
        _mongo_client = None
    
    _voyage_client = None
    
    logger.info("RAG retrieval connections cleaned up")