"""
Inbound pipeline for processing PDFs: download from S3, chunk, embed, and save to MongoDB.
Uses the new chunking.py and embedding.py modules.
"""

import os
import time
import boto3
import asyncio
import logging
from io import BytesIO
from typing import Optional, Dict, Any
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

# Import our modules
from app.pipeline.inbound.chunking.chunking import chunk_pdf
from app.pipeline.inbound.embedding.embedding import embed_and_save, get_mongo_client

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global thread pool for async operations
_thread_pool: Optional[ThreadPoolExecutor] = None


def get_thread_pool() -> ThreadPoolExecutor:
    """Get or create thread pool for CPU-bound operations."""
    global _thread_pool
    if _thread_pool is None:
        _thread_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="inbound_")
    return _thread_pool


def download_pdf_from_s3_sync(s3_file_path: str) -> Optional[BytesIO]:
    """
    Download PDF from S3 synchronously.
    
    Args:
        s3_file_path: S3 path in format "path/to/file.pdf" (without bucket)
    
    Returns:
        BytesIO containing the PDF data, or None if failed
    """
    try:
        bucket_name = os.getenv("S3_BUCKET_NAME")
        if not bucket_name:
            logger.error("S3_BUCKET_NAME environment variable not set")
            return None
        
        # Initialize S3 client
        s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        
        # Download file
        file_stream = BytesIO()
        s3_client.download_fileobj(bucket_name, s3_file_path, file_stream)
        file_stream.seek(0)
        
        logger.info(f"Successfully downloaded {s3_file_path} from S3 bucket {bucket_name}")
        return file_stream
        
    except Exception as e:
        logger.error(f"Failed to download {s3_file_path} from S3: {str(e)}")
        return None


async def download_pdf_from_s3(s3_file_path: str) -> Optional[BytesIO]:
    """
    Download PDF from S3 asynchronously.
    
    Args:
        s3_file_path: S3 path in format "path/to/file.pdf" (without bucket)
    
    Returns:
        BytesIO containing the PDF data, or None if failed
    """
    thread_pool = get_thread_pool()
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(thread_pool, download_pdf_from_s3_sync, s3_file_path)


def process_pdf_sync(course_id: str, slide_id: str, s3_file_path: str) -> Dict[str, Any]:
    """
    Synchronous version of the PDF processing pipeline.
    
    Args:
        course_id: Course identifier
        slide_id: Slide identifier
        s3_file_path: S3 path to the PDF file
    
    Returns:
        Dictionary with processing results and statistics
    """
    pipeline_start = time.time()
    logger.info(f"Starting PDF processing pipeline for: {s3_file_path}")
    
    # Step 1: Download PDF from S3
    step_start = time.time()
    file_stream = download_pdf_from_s3_sync(s3_file_path)
    if file_stream is None:
        return {
            "success": False,
            "error": "Failed to download PDF from S3",
            "course_id": course_id,
            "slide_id": slide_id,
            "s3_file_path": s3_file_path
        }
    download_time = time.time() - step_start
    file_size_mb = len(file_stream.getvalue()) / (1024 * 1024)
    logger.info(f"Downloaded {file_size_mb:.2f} MB in {download_time:.2f}s")
    
    # Step 2: Chunk the PDF
    step_start = time.time()
    try:
        chunks = chunk_pdf(
            course_id=course_id,
            slide_id=slide_id,
            s3_file_name=s3_file_path,
            file_stream=file_stream,
            max_words=350
        )
        chunking_time = time.time() - step_start
        logger.info(f"Created {len(chunks)} chunks in {chunking_time:.2f}s")
    except Exception as e:
        logger.error(f"Failed to chunk PDF: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to chunk PDF: {str(e)}",
            "course_id": course_id,
            "slide_id": slide_id,
            "s3_file_path": s3_file_path
        }
    
    # Step 3: Embed chunks and save to MongoDB
    step_start = time.time()
    try:
        # Use the combined embed_and_save function
        result = embed_and_save(chunks)
        embed_save_time = time.time() - step_start
        
        logger.info(f"Embedded and saved {result['save_stats']['inserted']} chunks in {embed_save_time:.2f}s")
        if result['save_stats'].get('duplicates', 0) > 0:
            logger.warning(f"Skipped {result['save_stats']['duplicates']} duplicate chunks")
        
    except Exception as e:
        logger.error(f"Failed to embed and save chunks: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to embed and save chunks: {str(e)}",
            "course_id": course_id,
            "slide_id": slide_id,
            "s3_file_path": s3_file_path,
            "chunks_created": len(chunks)
        }
    
    # Calculate total time
    total_time = time.time() - pipeline_start
    
    # Return success result
    return {
        "success": True,
        "course_id": course_id,
        "slide_id": slide_id,
        "s3_file_path": s3_file_path,
        "statistics": {
            "file_size_mb": file_size_mb,
            "total_pages": chunks[0]['total_pages'] if chunks else 0,
            "chunks_created": len(chunks),
            "chunks_embedded": result['embedding_stats']['chunks_embedded'],
            "chunks_saved": result['save_stats']['inserted'],
            "duplicates_skipped": result['save_stats'].get('duplicates', 0),
            "errors": len(result['save_stats']['errors'])
        },
        "timing": {
            "download_time": download_time,
            "chunking_time": chunking_time,
            "embedding_time": result['embedding_stats']['embedding_time'],
            "mongodb_save_time": result['save_time'],
            "total_time": total_time
        },
        "processing_time_ms": int(total_time * 1000)
    }


async def process_pdf_pipeline(course_id: str, slide_id: str, s3_file_path: str) -> Dict[str, Any]:
    """
    Asynchronous PDF processing pipeline.
    Downloads PDF from S3, chunks it, embeds the chunks, and saves to MongoDB.
    
    Args:
        course_id: Course identifier
        slide_id: Slide identifier
        s3_file_path: S3 path to the PDF file
    
    Returns:
        Dictionary with processing results and statistics
    """
    # Run the synchronous version in thread pool
    thread_pool = get_thread_pool()
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        thread_pool,
        process_pdf_sync,
        course_id,
        slide_id,
        s3_file_path
    )


def cleanup_connections():
    """Clean up connections on shutdown."""
    global _thread_pool
    
    if _thread_pool:
        _thread_pool.shutdown(wait=True)
        _thread_pool = None
    
    logger.info("Inbound pipeline connections cleaned up")


# Backward compatibility aliases
process_pdf_pipeline_optimized = process_pdf_pipeline
cleanup_inbound_connections = cleanup_connections