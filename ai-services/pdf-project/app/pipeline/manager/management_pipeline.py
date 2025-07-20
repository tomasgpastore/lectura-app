# Deletion functionality - delete vectors based on metadata filters
# TODO: Implement deletion functionality 

from app.config import get_env_var
from database.chroma_client import get_chroma_collection, chroma_count_vectors, chroma_delete_vectors, cleanup_chroma_client
import logging
import time
import asyncio
from typing import Dict, Optional, Union, List, Any
from concurrent.futures import ThreadPoolExecutor

# Configure logging
logger = logging.getLogger(__name__)

# Global connections - initialized once and reused
_chroma_collection = None
_thread_pool: Optional[ThreadPoolExecutor] = None

def get_thread_pool() -> ThreadPoolExecutor:
    """Get or create thread pool for CPU-bound operations"""
    global _thread_pool
    if _thread_pool is None:
        _thread_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="management_")
    return _thread_pool

def get_vector_collection():
    """Get or create ChromaDB collection (singleton)"""
    global _chroma_collection
    if _chroma_collection is None:
        _chroma_collection = get_chroma_collection()
        logger.info("ChromaDB collection initialized (management)")
    return _chroma_collection

async def delete_vectors_by_metadata(courseId: str, slideId: str, s3_fileName: str) -> Dict:
    """
    Delete vectors from ChromaDB based on metadata filters
    
    Args:
        courseId: Course identifier to filter by
        slideId: Slide identifier to filter by  
        s3_fileName: S3 file name to filter by
    
    Returns:
        dict: Deletion results with success status
    """
    logger.info(f"Starting vector deletion for: courseId={courseId}, slideId={slideId}, s3_fileName={s3_fileName}")
    deletion_start_time = time.time()
    
    try:
        # Use cached ChromaDB collection
        collection = get_vector_collection()
        logger.info("Successfully retrieved cached ChromaDB collection for deletion")
    except Exception as e:
        logger.error(f"Failed to connect to ChromaDB: {str(e)}")
        return {"success": False, "error": f"Failed to connect to ChromaDB: {str(e)}"}
    
    try:
        # Count vectors first (run in thread pool)
        def _count_vectors():
            return chroma_count_vectors(collection, courseId, slideId, s3_fileName)
        
        thread_pool = get_thread_pool()
        loop = asyncio.get_event_loop()
        vectors_to_delete = await loop.run_in_executor(thread_pool, _count_vectors)
        
        logger.info(f"Found {vectors_to_delete} vectors matching deletion criteria")
        
        if vectors_to_delete == 0:
            logger.info("No vectors found matching the specified criteria")
            return {
                "success": True,
                "message": "No vectors found matching the specified criteria",
                "courseId": courseId,
                "slideId": slideId,
                "s3_fileName": s3_fileName,
                "vectors_deleted": 0,
                "processing_time_ms": int((time.time() - deletion_start_time) * 1000)
            }
        
        # Delete vectors (run in thread pool)
        def _delete_vectors():
            return chroma_delete_vectors(collection, courseId, slideId, s3_fileName)
        
        delete_success = await loop.run_in_executor(thread_pool, _delete_vectors)
        
        # Calculate processing time
        deletion_end_time = time.time()
        processing_time_ms = int((deletion_end_time - deletion_start_time) * 1000)
        
        if delete_success:
            logger.info(f"Successfully deleted {vectors_to_delete} vectors in {processing_time_ms}ms")
            return {
                "success": True,
                "message": f"Successfully deleted {vectors_to_delete} vectors",
                "courseId": courseId,
                "slideId": slideId,
                "s3_fileName": s3_fileName,
                "vectors_deleted": vectors_to_delete,
                "processing_time_ms": processing_time_ms
            }
        else:
            raise Exception("ChromaDB delete operation failed")
        
    except Exception as e:
        processing_time_ms = int((time.time() - deletion_start_time) * 1000)
        logger.error(f"Failed to delete vectors: {str(e)}")
        return {
            "success": False, 
            "error": f"Failed to delete vectors: {str(e)}",
            "courseId": courseId,
            "slideId": slideId,
            "s3_fileName": s3_fileName,
            "vectors_deleted": 0,
            "processing_time_ms": processing_time_ms
        }

def cleanup_management_connections():
    """Clean up connections on shutdown"""
    global _thread_pool, _chroma_collection
    
    if _thread_pool:
        _thread_pool.shutdown(wait=True)
        _thread_pool = None
    
    # Reset cached connections
    _chroma_collection = None
    cleanup_chroma_client()
    
    logger.info("Management pipeline connections cleaned up") 