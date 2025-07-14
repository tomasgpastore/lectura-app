#!/usr/bin/env python3
"""
Test the improved console logging for pre-outbound and outbound pipelines
"""

import sys
import asyncio

# Add the app directory to Python path
sys.path.append('/Users/tomasgodoypastore/Downloads/lectura-app/ai-services/pdf-project')

from app.pre_outbound import QueryAnalysisRequest, process_pre_outbound_pipeline
from app.outbound_pipeline import OutboundRequest, process_outbound_pipeline_optimized

async def test_logging_with_retrieval():
    """Test logging for a query that needs retrieval"""
    print("🧪 TESTING IMPROVED CONSOLE LOGGING")
    print("="*80)
    print("Test 1: Query that NEEDS document retrieval")
    
    # Step 1: Pre-outbound analysis
    analysis_request = QueryAnalysisRequest(
        user_query="What does Peter Thiel say about monopolies and competition?",
        course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user_id="test_user_logging"
    )
    
    query_analysis = await process_pre_outbound_pipeline(analysis_request)
    
    # Step 2: Outbound pipeline with retrieval
    outbound_request = OutboundRequest(
        course="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user="test_user_logging",
        prompt=analysis_request.user_query,
        snapshot=None
    )
    
    # Collect just a few chunks to test the logging
    chunk_count = 0
    async for chunk in process_outbound_pipeline_optimized(
        request=outbound_request,
        expanded_query=query_analysis.expanded_query,
        needs_context=query_analysis.needs_context
    ):
        chunk_count += 1
        if chunk_count >= 5:  # Just collect a few chunks
            break
    
    return True

async def test_logging_without_retrieval():
    """Test logging for a query that doesn't need retrieval"""
    print("\n" + "="*80)
    print("Test 2: Query that DOESN'T need document retrieval")
    
    # Step 1: Pre-outbound analysis
    analysis_request = QueryAnalysisRequest(
        user_query="Thanks for that explanation!",
        course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user_id="test_user_logging"
    )
    
    query_analysis = await process_pre_outbound_pipeline(analysis_request)
    
    # Step 2: Outbound pipeline without retrieval
    outbound_request = OutboundRequest(
        course="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user="test_user_logging",
        prompt=analysis_request.user_query,
        snapshot=None
    )
    
    # Collect just a few chunks to test the logging
    chunk_count = 0
    async for chunk in process_outbound_pipeline_optimized(
        request=outbound_request,
        expanded_query=query_analysis.expanded_query,
        needs_context=query_analysis.needs_context
    ):
        chunk_count += 1
        if chunk_count >= 3:  # Just collect a few chunks
            break
    
    return True

async def main():
    """Run logging tests"""
    
    # Test with retrieval
    await test_logging_with_retrieval()
    
    # Test without retrieval
    await test_logging_without_retrieval()
    
    print("\n" + "="*80)
    print("✅ IMPROVED LOGGING TEST COMPLETED")
    print("="*80)
    print("Features demonstrated:")
    print("• Clear section headers with titles")
    print("• JSON output for pre-outbound analysis")
    print("• Step-by-step timing for each phase")
    print("• Detailed timing summary at the end")
    print("• Clean console output with proper formatting")
    print("="*80)

if __name__ == "__main__":
    asyncio.run(main())