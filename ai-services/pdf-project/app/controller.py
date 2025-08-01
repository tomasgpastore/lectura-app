from fastapi import FastAPI, status, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import time
from contextlib import asynccontextmanager
from app.config import validate_environment
from app.pipeline.inbound.inbound_pipeline import process_pdf_pipeline, cleanup_inbound_connections
from app.pipeline.manager.management_pipeline import delete_vectors_by_metadata, cleanup_management_connections
from app.pipeline.outbound.outbound_pipeline import (
    OutboundRequest, 
    ChatResponseDTO,
    process_outbound_pipeline,
    cleanup_outbound_connections
)

# Configure logging
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown"""
    # Startup
    logger.info("Application starting up...")
    yield
    # Shutdown
    logger.info("Application shutting down, cleaning up resources...")
    cleanup_outbound_connections()
    cleanup_inbound_connections()
    cleanup_management_connections()
    logger.info("Resource cleanup completed")

app = FastAPI(
    title="PDF Processing Pipeline API",
    description="Microservice API for processing PDF files from S3, chunking them, embedding with Voyage AI, and storing in MongoDB",
    version="3.0.0",
    lifespan=lifespan
)

class InboundRequest(BaseModel):
    course_id: str
    slide_id: str
    s3_file_name: str  # S3 object key/filename

class InboundResponse(BaseModel):
    status: str
    message: str
    course_id: str
    slide_id: str
    s3_file_name: str
    processing_time_ms: int
    total_pages: Optional[int] = None
    total_chunks: Optional[int] = None
    successful_uploads: Optional[int] = None
    failed_batches: Optional[int] = None

class ManagementRequest(BaseModel):
    course_id: str
    slide_id: str
    s3_file_name: str

class ManagementResponse(BaseModel):
    status: str
    message: str
    course_id: str
    slide_id: str
    s3_file_name: str
    processing_time_ms: int
    vectors_deleted: Optional[int] = None

@app.post("/inbound", status_code=status.HTTP_200_OK, response_model=InboundResponse)
async def process_pdf(request: InboundRequest):
    """
    Process PDF from S3: chunk it, embed with Voyage AI, and save to MongoDB
    
    Args:
        request: Contains course_id, slide_id, and s3_file_name
        
    Returns:
        Processing results and metrics
    """
    start_time = time.time()
    logger.info(f"Received processing request: course_id={request.course_id}, slide_id={request.slide_id}, s3_file_name={request.s3_file_name}")
    
    # Validate required environment variables
    is_valid, missing_vars = validate_environment()
    if not is_valid:
        logger.error(f"Missing required environment variables: {missing_vars}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server configuration error: Missing environment variables: {', '.join(missing_vars)}"
        )
    
    try:
        # Call the async pipeline function directly
        logger.info("Starting PDF processing pipeline")
        result = await process_pdf_pipeline(
            course_id=request.course_id,
            slide_id=request.slide_id,
            s3_file_path=request.s3_file_name
        )
        
        # Calculate total processing time
        end_time = time.time()
        processing_time_ms = int((end_time - start_time) * 1000)
        
        # Check if pipeline was successful
        if result.get("success", False):
            logger.info(f"Pipeline completed successfully in {processing_time_ms}ms")
            logger.info(f"Pipeline results: {result}")
            
            # Extract statistics from the new response format
            stats = result.get("statistics", {})
            
            response = InboundResponse(
                status="success",
                message="PDF processed and saved to MongoDB successfully",
                course_id=request.course_id,
                slide_id=request.slide_id,
                s3_file_name=request.s3_file_name,
                processing_time_ms=result.get("processing_time_ms", processing_time_ms),
                total_pages=stats.get("total_pages"),
                total_chunks=stats.get("chunks_created"),
                successful_uploads=stats.get("chunks_saved"),
                failed_batches=stats.get("errors", 0)
            )
            
            # Add warning if there were duplicates
            if stats.get("duplicates_skipped", 0) > 0:
                response.message += f" (Info: {stats['duplicates_skipped']} duplicate chunks skipped)"
            
            # Add warning if there were errors
            if stats.get("errors", 0) > 0:
                response.message += f" (Warning: {stats['errors']} errors occurred during processing)"
            
            return response
            
        else:
            # Pipeline failed
            error_msg = result.get("error", "Unknown pipeline error")
            logger.error(f"Pipeline failed: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Pipeline processing failed: {error_msg}"
            )
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in pipeline processing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal processing error: {str(e)}"
        )

@app.delete("/management", status_code=status.HTTP_200_OK, response_model=ManagementResponse)
async def delete_vectors(request: ManagementRequest):
    """
    Delete vectors from MongoDB based on metadata filters
    
    Args:
        request: Contains course_id, slide_id, and s3_file_name for filtering
        
    Returns:
        Deletion results and metrics
    """
    start_time = time.time()
    logger.info(f"Received deletion request: course_id={request.course_id}, slide_id={request.slide_id}, s3_file_name={request.s3_file_name}")
    
    # Validate required environment variables
    is_valid, missing_vars = validate_environment()
    if not is_valid:
        logger.error(f"Missing required environment variables: {missing_vars}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server configuration error: Missing environment variables: {', '.join(missing_vars)}"
        )
    
    try:
        # Call the async deletion function
        logger.info("Starting vector deletion")
        result = await delete_vectors_by_metadata(
            course_id=request.course_id,
            slide_id=request.slide_id,
            s3_file_name=request.s3_file_name
        )
        
        # Calculate total processing time
        end_time = time.time()
        processing_time_ms = int((end_time - start_time) * 1000)
        
        # Check if deletion was successful
        if result.get("success", False):
            logger.info(f"Deletion completed successfully in {processing_time_ms}ms")
            logger.info(f"Deletion results: {result}")
            
            response = ManagementResponse(
                status="success",
                message=result.get("message", "Vectors deleted successfully"),
                course_id=request.course_id,
                slide_id=request.slide_id,
                s3_file_name=request.s3_file_name,
                processing_time_ms=processing_time_ms,
                vectors_deleted=result.get("vectors_deleted", 0)
            )
            
            return response
            
        else:
            # Deletion failed
            error_msg = result.get("error", "Unknown deletion error")
            logger.error(f"Deletion failed: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Deletion failed: {error_msg}"
            )
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in deletion: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal deletion error: {str(e)}"
        )

@app.post("/outbound", status_code=status.HTTP_200_OK, response_model=ChatResponseDTO)
async def query_llm(request: OutboundRequest):
    """
    Process user query through the intelligent agent with RAG/Web search capabilities
    
    The agent supports:
    - DEFAULT: Direct LLM response without search
    - RAG: Search in course materials using vector similarity
    - WEB: Search the internet for current information
    - RAG_WEB: Combine course materials and web search
    
    Args:
        request: Contains user, course, prompt, searchType, slides priority, and optional snapshots
        
    Returns:
        JSON response with agent response and sources (ragSources and webSources)
    """
    logger.info(f"Received outbound request: course_id={request.course_id}, user_id={request.user_id}")
    logger.info(f"Search type: {request.search_type}, Slides: {request.slide_priority}")
    logger.info(f"User query: '{request.user_prompt[:100]}...'")
    
    # Validate required environment variables
    is_valid, missing_vars = validate_environment()
    if not is_valid:
        logger.error(f"Missing required environment variables: {missing_vars}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server configuration error: Missing environment variables: {', '.join(missing_vars)}"
        )
    
    try:
        # Process through the intelligent agent
        response = await process_outbound_pipeline(request)
        
        logger.info(f"✅ Outbound pipeline completed successfully")
        logger.info(f"   Response length: {len(response.response)} chars")
        logger.info(f"   RAG sources: {len(response.ragSources)}")
        logger.info(f"   Web sources: {len(response.webSources)}")
        
        return response
        
    except Exception as e:
        logger.error(f"Unexpected error in outbound pipeline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal processing error: {str(e)}"
        ) 