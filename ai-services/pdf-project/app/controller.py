from fastapi import FastAPI, status, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import time
from app.config import validate_environment
from app.inbound_pipeline import process_pdf_pipeline, cleanup_inbound_connections
from app.management_pipeline import delete_vectors_by_metadata, cleanup_management_connections
from app.outbound_pipeline_nostream import (
    OutboundRequest, 
    ChatResponseDTO,
    process_outbound_pipeline_optimized,
    cleanup_connections
)
from app.pre_outbound import (
    QueryAnalysisRequest,
    process_pre_outbound_pipeline,
    cleanup_pre_outbound_connections
)

# Configure logging
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PDF Processing Pipeline API",
    description="Microservice API for processing PDF files from S3 and uploading chunks to Pinecone",
    version="2.0.0"
)

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on application shutdown"""
    logger.info("Application shutting down, cleaning up resources...")
    cleanup_connections()
    cleanup_inbound_connections()
    cleanup_management_connections()
    cleanup_pre_outbound_connections()
    logger.info("Resource cleanup completed")

class InboundRequest(BaseModel):
    courseId: str
    slideId: str
    s3_fileName: str  # S3 object key/filename

class InboundResponse(BaseModel):
    status: str
    message: str
    courseId: str
    slideId: str
    s3_fileName: str
    processing_time_ms: int
    total_pages: Optional[int] = None
    total_chunks: Optional[int] = None
    successful_uploads: Optional[int] = None
    failed_batches: Optional[int] = None

class ManagementRequest(BaseModel):
    courseId: str
    slideId: str
    s3_fileName: str

class ManagementResponse(BaseModel):
    status: str
    message: str
    courseId: str
    slideId: str
    s3_fileName: str
    processing_time_ms: int
    vectors_deleted: Optional[int] = None

@app.post("/inbound", status_code=status.HTTP_200_OK, response_model=InboundResponse)
async def process_pdf(request: InboundRequest):
    """
    Process PDF from S3 and upload chunks to Pinecone
    
    Args:
        request: Contains courseId, slideId, and s3_fileName
        
    Returns:
        Processing results and metrics
    """
    start_time = time.time()
    logger.info(f"Received processing request: courseId={request.courseId}, slideId={request.slideId}, s3_fileName={request.s3_fileName}")
    
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
            fileName=request.s3_fileName,
            courseId=request.courseId,
            slideId=request.slideId
        )
        
        # Calculate total processing time
        end_time = time.time()
        processing_time_ms = int((end_time - start_time) * 1000)
        
        # Check if pipeline was successful
        if result.get("success", False):
            logger.info(f"Pipeline completed successfully in {processing_time_ms}ms")
            logger.info(f"Pipeline results: {result}")
            
            response = InboundResponse(
                status="success",
                message="PDF processed and uploaded to Pinecone successfully",
                courseId=request.courseId,
                slideId=request.slideId,
                s3_fileName=request.s3_fileName,
                processing_time_ms=processing_time_ms,
                total_pages=result.get("total_pages"),
                total_chunks=result.get("total_chunks"),
                successful_uploads=result.get("successful_uploads"),
                failed_batches=result.get("failed_batches")
            )
            
            # Add warning if there were failed batches
            if result.get("failed_batches", 0) > 0:
                response.message += f" (Warning: {result['failed_batches']} batches failed to upload)"
            
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
    Delete vectors from Pinecone based on metadata filters
    
    Args:
        request: Contains courseId, slideId, and s3_fileName for filtering
        
    Returns:
        Deletion results and metrics
    """
    start_time = time.time()
    logger.info(f"Received deletion request: courseId={request.courseId}, slideId={request.slideId}, s3_fileName={request.s3_fileName}")
    
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
            courseId=request.courseId,
            slideId=request.slideId,
            s3_fileName=request.s3_fileName
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
                courseId=request.courseId,
                slideId=request.slideId,
                s3_fileName=request.s3_fileName,
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
    Process user query through the intelligent outbound pipeline with pre-analysis
    
    Pipeline steps:
    1. Pre-outbound analysis: Determine if retrieval is needed and expand query
    2. Conditional retrieval: Only retrieve documents if analysis indicates it's needed
    3. Generate complete LLM response with relevant sources (if any)
    
    Args:
        request: Contains course_id, user_id, user_prompt, and optional snapshot
        
    Returns:
        JSON response with complete LLM response and sources
    """
    logger.info(f"Received intelligent outbound request: course_id={request.course}, user_id={request.user}")
    logger.info(f"User query: '{request.prompt[:100]}...'")
    
    # Validate required environment variables
    is_valid, missing_vars = validate_environment()
    if not is_valid:
        logger.error(f"Missing required environment variables: {missing_vars}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server configuration error: Missing environment variables: {', '.join(missing_vars)}"
        )
    
    try:
        # Step 1: Analyze query to determine if retrieval is needed
        logger.info("🔍 Step 1: Analyzing query intent...")
        analysis_request = QueryAnalysisRequest(
            user_query=request.prompt,
            course_id=request.course,
            user_id=request.user
        )
        
        query_analysis = await process_pre_outbound_pipeline(analysis_request)
        
        logger.info(f"✅ Query analysis completed:")
        logger.info(f"   Needs context: {query_analysis.needs_context}")
        logger.info(f"   Image priority: {query_analysis.image_priority}")
        logger.info(f"   Reasoning: {query_analysis.reasoning}")
        if query_analysis.expanded_query != request.prompt:
            logger.info(f"   Expanded query: '{query_analysis.expanded_query[:100]}...'")
        
        # Step 2: Process through optimized outbound pipeline with conditional retrieval
        logger.info("🚀 Step 2: Starting optimized outbound pipeline...")
        
        response = await process_outbound_pipeline_optimized(
            request=request,
            expanded_query=query_analysis.expanded_query,
            needs_context=query_analysis.needs_context,
            image_priority=query_analysis.image_priority
        )
        
        logger.info(f"✅ Outbound pipeline completed successfully")
        logger.info(f"   Response length: {len(response.response)} chars")
        logger.info(f"   Sources found: {len(response.data)}")
        
        return response
        
    except Exception as e:
        logger.error(f"Unexpected error in intelligent outbound pipeline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal processing error: {str(e)}"
        ) 