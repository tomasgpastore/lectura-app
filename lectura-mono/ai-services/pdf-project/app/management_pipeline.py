# Deletion functionality - delete vectors based on metadata filters
# TODO: Implement deletion functionality 

from pinecone.grpc.pinecone import PineconeGRPC as Pinecone
from app.config import get_env_var
import logging
import time
from typing import Dict

# Configure logging
logger = logging.getLogger(__name__)

async def delete_vectors_by_metadata(courseId: str, slideId: str, s3_fileName: str) -> Dict:
    """
    Delete vectors from Pinecone based on metadata filters
    
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
        # Connect to Pinecone
        pc = Pinecone(api_key=get_env_var("PINECONE_API_KEY"))
        
        # Use same index name as other pipelines
        index_name = get_env_var('PINECONE_INDEX_NAME')
        
        if not index_name:
            raise ValueError("PINECONE_INDEX_NAME environment variable not set")
        
        index = pc.Index(index_name)
        logger.info(f"Successfully connected to Pinecone index '{index_name}' for deletion")
    except Exception as e:
        logger.error(f"Failed to connect to Pinecone: {str(e)}")
        return {"success": False, "error": f"Failed to connect to Pinecone: {str(e)}"}
    
    try:
        # Query first to get count of vectors that match our filters
        query_response = index.query(
            vector=[0.0] * 1536,  # Dummy vector for counting
            top_k=10000,  # Large number to get all matches
            include_metadata=True,
            filter={
                "courseId": {"$eq": courseId},
                "slideId": {"$eq": slideId}, 
                "s3_path": {"$eq": s3_fileName}
            }
        )
        
        vectors_to_delete = len(query_response.matches)
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
        
        # Delete vectors using metadata filter
        delete_response = index.delete(
            filter={
                "courseId": {"$eq": courseId},
                "slideId": {"$eq": slideId},
                "s3_path": {"$eq": s3_fileName}
            }
        )
        
        # Calculate processing time
        deletion_end_time = time.time()
        processing_time_ms = int((deletion_end_time - deletion_start_time) * 1000)
        
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