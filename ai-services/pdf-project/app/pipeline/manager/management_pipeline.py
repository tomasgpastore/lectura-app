# Deletion functionality - delete documents from MongoDB based on metadata filters

import os
import logging
import time
import asyncio
from typing import Dict, Optional
from concurrent.futures import ThreadPoolExecutor
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Global connections - initialized once and reused
_mongo_client: Optional[MongoClient] = None
_thread_pool: Optional[ThreadPoolExecutor] = None


def get_thread_pool() -> ThreadPoolExecutor:
    """Get or create thread pool for CPU-bound operations"""
    global _thread_pool
    if _thread_pool is None:
        _thread_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="management_")
    return _thread_pool


def get_mongo_client() -> MongoClient:
    """Get or create MongoDB client (singleton)"""
    global _mongo_client
    if _mongo_client is None:
        mongo_uri = os.getenv('MONGO_URI')
        if not mongo_uri:
            raise ValueError("MONGO_URI not found in .env file")
        _mongo_client = MongoClient(mongo_uri)
        logger.info("MongoDB client initialized (management)")
    return _mongo_client


def count_documents_sync(course_id: str, slide_id: str, s3_file_name: str) -> int:
    """
    Count documents in MongoDB based on metadata filters
    
    Args:
        course_id: Course identifier to filter by
        slide_id: Slide identifier to filter by
        s3_file_name: S3 file name to filter by
    
    Returns:
        Number of documents matching the criteria
    """
    # Get MongoDB configuration
    db_name = os.getenv('MONGO_DB')
    collection_name = os.getenv('MONGO_COLLECTION_NAME')
    
    if not db_name or not collection_name:
        raise ValueError("MONGO_DB and MONGO_COLLECTION_NAME must be set in .env")
    
    # Get client and collection
    client = get_mongo_client()
    db = client[db_name]
    collection = db[collection_name]
    
    # Build filter
    filter_query = {}
    if course_id:
        filter_query["course_id"] = course_id
    if slide_id:
        filter_query["slide_id"] = slide_id
    if s3_file_name:
        filter_query["s3_file_name"] = s3_file_name
    
    # Count documents
    count = collection.count_documents(filter_query)
    return count


def delete_documents_sync(course_id: str, slide_id: str, s3_file_name: str) -> Dict[str, any]:
    """
    Delete documents from MongoDB based on metadata filters
    
    Args:
        course_id: Course identifier to filter by
        slide_id: Slide identifier to filter by
        s3_file_name: S3 file name to filter by
    
    Returns:
        Dictionary with deletion results
    """
    # Get MongoDB configuration
    db_name = os.getenv('MONGO_DB')
    collection_name = os.getenv('MONGO_COLLECTION_NAME')
    
    if not db_name or not collection_name:
        raise ValueError("MONGO_DB and MONGO_COLLECTION_NAME must be set in .env")
    
    # Get client and collection
    client = get_mongo_client()
    db = client[db_name]
    collection = db[collection_name]
    
    # Build filter
    filter_query = {}
    if course_id:
        filter_query["course_id"] = course_id
    if slide_id:
        filter_query["slide_id"] = slide_id
    if s3_file_name:
        filter_query["s3_file_name"] = s3_file_name
    
    # Delete documents
    result = collection.delete_many(filter_query)
    
    return {
        "deleted_count": result.deleted_count,
        "acknowledged": result.acknowledged
    }


async def delete_vectors_by_metadata(course_id: str, slide_id: str, s3_file_name: str) -> Dict:
    """
    Delete documents from MongoDB based on metadata filters
    
    Args:
        course_id: Course identifier to filter by
        slide_id: Slide identifier to filter by  
        s3_file_name: S3 file name to filter by
    
    Returns:
        dict: Deletion results with success status
    """
    logger.info(f"Starting document deletion for: course_id={course_id}, slide_id={slide_id}, s3_file_name={s3_file_name}")
    deletion_start_time = time.time()
    
    try:
        # Count documents first (run in thread pool)
        thread_pool = get_thread_pool()
        loop = asyncio.get_event_loop()
        
        documents_to_delete = await loop.run_in_executor(
            thread_pool, 
            count_documents_sync, 
            course_id, 
            slide_id, 
            s3_file_name
        )
        
        logger.info(f"Found {documents_to_delete} documents matching deletion criteria")
        
        if documents_to_delete == 0:
            logger.info("No documents found matching the specified criteria")
            return {
                "success": True,
                "message": "No documents found matching the specified criteria",
                "course_id": course_id,
                "slide_id": slide_id,
                "s3_file_name": s3_file_name,
                "vectors_deleted": 0,
                "processing_time_ms": int((time.time() - deletion_start_time) * 1000)
            }
        
        # Delete documents (run in thread pool)
        delete_result = await loop.run_in_executor(
            thread_pool,
            delete_documents_sync,
            course_id,
            slide_id,
            s3_file_name
        )
        
        # Calculate processing time
        deletion_end_time = time.time()
        processing_time_ms = int((deletion_end_time - deletion_start_time) * 1000)
        
        if delete_result["acknowledged"]:
            logger.info(f"Successfully deleted {delete_result['deleted_count']} documents in {processing_time_ms}ms")
            return {
                "success": True,
                "message": f"Successfully deleted {delete_result['deleted_count']} documents",
                "course_id": course_id,
                "slide_id": slide_id,
                "s3_file_name": s3_file_name,
                "vectors_deleted": delete_result['deleted_count'],
                "processing_time_ms": processing_time_ms
            }
        else:
            raise Exception("MongoDB delete operation was not acknowledged")
        
    except Exception as e:
        processing_time_ms = int((time.time() - deletion_start_time) * 1000)
        logger.error(f"Failed to delete documents: {str(e)}")
        return {
            "success": False, 
            "error": f"Failed to delete documents: {str(e)}",
            "course_id": course_id,
            "slide_id": slide_id,
            "s3_file_name": s3_file_name,
            "vectors_deleted": 0,
            "processing_time_ms": processing_time_ms
        }


def cleanup_management_connections():
    """Clean up connections on shutdown"""
    global _thread_pool, _mongo_client
    
    if _thread_pool:
        _thread_pool.shutdown(wait=True)
        _thread_pool = None
    
    if _mongo_client:
        _mongo_client.close()
        _mongo_client = None
    
    logger.info("Management pipeline connections cleaned up")