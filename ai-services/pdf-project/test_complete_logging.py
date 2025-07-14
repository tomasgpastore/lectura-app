#!/usr/bin/env python3
"""
Test complete logging flow to see the full timing summary
"""

import sys
import asyncio

# Add the app directory to Python path
sys.path.append('/Users/tomasgodoypastore/Downloads/lectura-app/ai-services/pdf-project')

from app.pre_outbound import QueryAnalysisRequest, process_pre_outbound_pipeline
from app.outbound_pipeline import OutboundRequest, process_outbound_pipeline_optimized

async def test_complete_logging():
    """Test complete logging flow"""
    print("🧪 COMPLETE LOGGING FLOW TEST")
    print("="*80)
    
    # Step 1: Pre-outbound analysis
    analysis_request = QueryAnalysisRequest(
        user_query="What are the key principles for building a monopoly?",
        course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user_id="complete_test_user"
    )
    
    query_analysis = await process_pre_outbound_pipeline(analysis_request)
    
    # Step 2: Complete outbound pipeline
    outbound_request = OutboundRequest(
        course="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user="complete_test_user",
        prompt=analysis_request.user_query,
        snapshot=None
    )
    
    # Process complete pipeline to see full timing
    response_chunks = []
    async for chunk in process_outbound_pipeline_optimized(
        request=outbound_request,
        expanded_query=query_analysis.expanded_query,
        needs_context=query_analysis.needs_context
    ):
        response_chunks.append(chunk)
        # Let it complete to see full timing summary
    
    print(f"\n✅ Complete flow test finished!")
    print(f"📊 Total response chunks: {len(response_chunks)}")

async def test_no_retrieval_complete():
    """Test complete flow for no-retrieval query"""
    print("\n" + "="*80)
    print("Testing No-Retrieval Query Complete Flow")
    
    # Step 1: Pre-outbound analysis
    analysis_request = QueryAnalysisRequest(
        user_query="Hello, how are you?",
        course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user_id="complete_test_user"
    )
    
    query_analysis = await process_pre_outbound_pipeline(analysis_request)
    
    # Step 2: Complete outbound pipeline
    outbound_request = OutboundRequest(
        course="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user="complete_test_user",
        prompt=analysis_request.user_query,
        snapshot=None
    )
    
    # Process complete pipeline to see full timing
    response_chunks = []
    async for chunk in process_outbound_pipeline_optimized(
        request=outbound_request,
        expanded_query=query_analysis.expanded_query,
        needs_context=query_analysis.needs_context
    ):
        response_chunks.append(chunk)
        # Let it complete to see full timing summary
    
    print(f"\n✅ No-retrieval flow test finished!")
    print(f"📊 Total response chunks: {len(response_chunks)}")

async def main():
    """Run complete logging tests"""
    
    # Test 1: With retrieval
    await test_complete_logging()
    
    # Test 2: Without retrieval
    await test_no_retrieval_complete()
    
    print("\n" + "="*80)
    print("🎉 ALL LOGGING TESTS COMPLETED")
    print("="*80)
    print("Console logging now provides:")
    print("• 🧠 Clear PRE-OUTBOUND section with JSON analysis")
    print("• 🚀 Clear OUTBOUND section with step-by-step progress") 
    print("• ⏱️  Detailed timing for each phase")
    print("• 📊 Summary with results and performance metrics")
    print("• 🎯 Easy to read formatting and emojis")
    print("="*80)

if __name__ == "__main__":
    asyncio.run(main())