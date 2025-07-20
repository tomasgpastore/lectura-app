import chromadb
from chromadb.config import Settings
from chromadb.api import ClientAPI
from typing import List, Dict, Any, Optional
import logging
import os

logger = logging.getLogger(__name__)

_chroma_client: Optional[ClientAPI] = None
_chroma_collection = None

def get_chroma_client() -> ClientAPI:
    """Get or create ChromaDB client (singleton)"""
    global _chroma_client
    if _chroma_client is None:
        # Create data directory if it doesn't exist
        data_dir = "/Users/tomasgodoypastore/Downloads/lectura-app/ai-services/pdf-project/chroma_data"
        os.makedirs(data_dir, exist_ok=True)
        
        logger.info(f"Initializing ChromaDB client with persistent storage at: {data_dir}")
        _chroma_client = chromadb.PersistentClient(
            path=data_dir,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        logger.info("✅ ChromaDB client initialized")
    return _chroma_client

def get_chroma_collection(collection_name: str = "lectura_vectors"):
    """Get or create ChromaDB collection (singleton)"""
    global _chroma_collection
    if _chroma_collection is None:
        client = get_chroma_client()
        
        try:
            # Try to get existing collection
            _chroma_collection = client.get_collection(name=collection_name)
            logger.info(f"✅ Found existing ChromaDB collection: {collection_name}")
        except Exception:
            # Create new collection if it doesn't exist
            logger.info(f"Creating new ChromaDB collection: {collection_name}")
            _chroma_collection = client.create_collection(
                name=collection_name,
                metadata={"description": "Lectura app vector embeddings"}
            )
            logger.info(f"✅ ChromaDB collection '{collection_name}' created")
    
    return _chroma_collection

def safe_chroma_upsert(
    collection,
    vectors: List[Dict[str, Any]], 
    max_retries: int = 3
) -> bool:
    """Upload vectors to ChromaDB with retry logic"""
    for attempt in range(max_retries):
        try:
            logger.info(f"🔄 Uploading {len(vectors)} vectors to ChromaDB (attempt {attempt + 1}/{max_retries})")
            
            # Prepare data for ChromaDB
            ids = [vec["id"] for vec in vectors]
            embeddings = [vec["values"] for vec in vectors]
            metadatas = [vec["metadata"] for vec in vectors]
            documents = [vec["metadata"].get("rawText", "") for vec in vectors]
            
            # Upsert to ChromaDB
            collection.upsert(
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=documents
            )
            
            logger.info(f"✅ ChromaDB upsert successful: {len(vectors)} vectors uploaded")
            return True
            
        except Exception as e:
            logger.warning(f"❌ ChromaDB upload attempt {attempt + 1}/{max_retries} failed: {str(e)}")
            if attempt < max_retries - 1:
                import time
                wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                logger.info(f"⏳ Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
    
    # If we get here, all retries failed
    logger.error(f"💥 Failed to upload batch of {len(vectors)} vectors after {max_retries} attempts")
    return False

def chroma_query_vectors(
    collection,
    query_embedding: List[float],
    course_id: str,
    top_k: int = 10
) -> List[Dict[str, Any]]:
    """Query similar vectors from ChromaDB with courseId filter"""
    try:
        logger.info(f"🔍 Querying ChromaDB for top {top_k} vectors (course: {course_id})")
        
        # Query ChromaDB with metadata filter
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where={"courseId": course_id},
            include=["metadatas", "distances", "documents"]
        )
        
        # Convert ChromaDB results to our format
        formatted_results = []
        if results["metadatas"] and results["metadatas"][0]:
            for i, metadata in enumerate(results["metadatas"][0]):
                # ChromaDB returns distances (lower is better), convert to similarity score
                distance = results["distances"][0][i] if results["distances"] else 1.0
                score = 1.0 / (1.0 + distance)  # Convert distance to similarity
                
                # Only include decent matches (lowered threshold for semantic similarity)
                if score >= 0.02:
                    formatted_results.append({
                        "score": score,
                        "metadata": metadata
                    })
                    logger.debug(f"📄 Found match: score={score:.3f}, slide={metadata.get('slideId', 'unknown')}")
        
        logger.info(f"✅ Retrieved {len(formatted_results)} relevant vectors from ChromaDB")
        return formatted_results
        
    except Exception as e:
        logger.error(f"❌ Error retrieving vectors from ChromaDB: {str(e)}")
        return []

def chroma_count_vectors(
    collection,
    course_id: str,
    slide_id: str,
    s3_path: str
) -> int:
    """Count vectors matching filter criteria in ChromaDB"""
    try:
        # Query with filters to count matching vectors
        results = collection.query(
            query_embeddings=[[0.0] * 384],  # Dummy embedding for counting
            n_results=10000,  # Large number to get all matches
            where={
                "courseId": course_id,
                "slideId": slide_id,
                "s3_path": s3_path
            },
            include=["metadatas"]
        )
        
        count = len(results["metadatas"][0]) if results["metadatas"] else 0
        logger.info(f"Found {count} vectors matching deletion criteria")
        return count
        
    except Exception as e:
        logger.error(f"Error counting vectors in ChromaDB: {str(e)}")
        return 0

def chroma_delete_vectors(
    collection,
    course_id: str,
    
    slide_id: str,
    s3_path: str
) -> bool:
    """Delete vectors from ChromaDB based on metadata filters"""
    try:
        # First, get all IDs that match the criteria
        results = collection.query(
            query_embeddings=[[0.0] * 384],  # Dummy embedding
            n_results=10000,  # Large number to get all matches
            where={
                "courseId": course_id,
                "slideId": slide_id,
                "s3_path": s3_path
            },
            include=["ids", "metadatas"]
        )
        
        # Get the IDs from results
        ids_to_delete = results.get("ids", [[]])[0] if results.get("ids") else []
        
        if ids_to_delete:
            logger.info(f"Found {len(ids_to_delete)} vectors to delete")
            collection.delete(ids=ids_to_delete)
            logger.info(f"Successfully deleted {len(ids_to_delete)} vectors from ChromaDB")
            return True
        else:
            logger.info("No vectors found to delete")
            return True
        
    except Exception as e:
        logger.error(f"Error deleting vectors from ChromaDB: {str(e)}")
        return False

def cleanup_chroma_client():
    """Clean up ChromaDB client on shutdown"""
    global _chroma_client, _chroma_collection
    _chroma_client = None
    _chroma_collection = None
    logger.info("ChromaDB client cleaned up")