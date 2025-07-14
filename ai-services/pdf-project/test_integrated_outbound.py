#!/usr/bin/env python3
"""
Test script for the integrated outbound pipeline with pre-outbound analysis
"""

import sys
import asyncio
import json

# Add the app directory to Python path
sys.path.append('/Users/tomasgodoypastore/Downloads/lectura-app/ai-services/pdf-project')

from app.outbound_pipeline import OutboundRequest, process_outbound_pipeline_optimized
from app.pre_outbound import QueryAnalysisRequest, process_pre_outbound_pipeline

async def test_retrieval_needed_query():
    """Test a query that needs document retrieval"""
    print("🧪 Test 1: Query that NEEDS document retrieval")
    print("=" * 60)
    
    # First, run pre-outbound analysis
    analysis_request = QueryAnalysisRequest(
        user_query="What does Peter Thiel say about monopolies and competition in Zero to One?",
        course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",  # Use actual course ID
        user_id="test_user_123"
    )
    
    print(f"📝 Original Query: '{analysis_request.user_query}'")
    
    # Step 1: Pre-outbound analysis
    print("\n🔍 Step 1: Pre-outbound analysis...")
    query_analysis = await process_pre_outbound_pipeline(analysis_request)
    
    print(f"✅ Analysis Results:")
    print(f"   Needs context: {query_analysis.needs_context}")
    print(f"   Expanded query: '{query_analysis.expanded_query}'")
    print(f"   Reasoning: {query_analysis.reasoning}")
    
    # Step 2: Outbound pipeline with analysis results
    print(f"\n🚀 Step 2: Outbound pipeline (with retrieval: {query_analysis.needs_context})...")
    
    outbound_request = OutboundRequest(
        course="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user="test_user_123",
        prompt=analysis_request.user_query,
        snapshot=None
    )
    
    # Collect response chunks
    response_chunks = []
    sources_data = None
    
    async for chunk in process_outbound_pipeline_optimized(
        request=outbound_request,
        expanded_query=query_analysis.expanded_query,
        needs_context=query_analysis.needs_context
    ):
        response_chunks.append(chunk)
        
        # Parse sources event
        if chunk.startswith("event: sources"):
            data_line = chunk.split("data: ", 1)[1].split("\n")[0]
            try:
                sources_data = json.loads(data_line)
                print(f"📚 Sources retrieved: {len(sources_data)} sources")
            except json.JSONDecodeError:
                print("⚠️  Could not parse sources data")
        
        # Show first few tokens
        elif chunk.startswith("event: token"):
            token_data = chunk.split("data: ", 1)[1].split("\n")[0]
            if len([c for c in response_chunks if c.startswith("event: token")]) <= 3:
                print(f"🤖 Token: {token_data[:50]}...")
    
    print(f"\n✅ Pipeline completed! Received {len(response_chunks)} chunks")
    print(f"📊 Sources found: {len(sources_data) if sources_data else 0}")
    
    return query_analysis.needs_context and (sources_data is not None)

async def test_no_retrieval_query():
    """Test a query that doesn't need document retrieval"""
    print("\n🧪 Test 2: Query that DOESN'T need document retrieval")
    print("=" * 60)
    
    # First, run pre-outbound analysis
    analysis_request = QueryAnalysisRequest(
        user_query="Can you explain that in simpler terms?",
        course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user_id="test_user_123"
    )
    
    print(f"📝 Original Query: '{analysis_request.user_query}'")
    
    # Step 1: Pre-outbound analysis
    print("\n🔍 Step 1: Pre-outbound analysis...")
    query_analysis = await process_pre_outbound_pipeline(analysis_request)
    
    print(f"✅ Analysis Results:")
    print(f"   Needs context: {query_analysis.needs_context}")
    print(f"   Expanded query: '{query_analysis.expanded_query}'")
    print(f"   Reasoning: {query_analysis.reasoning}")
    
    # Step 2: Outbound pipeline with analysis results
    print(f"\n🚀 Step 2: Outbound pipeline (with retrieval: {query_analysis.needs_context})...")
    
    outbound_request = OutboundRequest(
        course="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user="test_user_123",
        prompt=analysis_request.user_query,
        snapshot=None
    )
    
    # Collect response chunks
    response_chunks = []
    sources_data = None
    
    async for chunk in process_outbound_pipeline_optimized(
        request=outbound_request,
        expanded_query=query_analysis.expanded_query,
        needs_context=query_analysis.needs_context
    ):
        response_chunks.append(chunk)
        
        # Parse sources event
        if chunk.startswith("event: sources"):
            data_line = chunk.split("data: ", 1)[1].split("\n")[0]
            try:
                sources_data = json.loads(data_line)
                print(f"📚 Sources retrieved: {len(sources_data)} sources (should be 0)")
            except json.JSONDecodeError:
                print("⚠️  Could not parse sources data")
        
        # Show first few tokens
        elif chunk.startswith("event: token"):
            token_data = chunk.split("data: ", 1)[1].split("\n")[0]
            if len([c for c in response_chunks if c.startswith("event: token")]) <= 3:
                print(f"🤖 Token: {token_data[:50]}...")
    
    print(f"\n✅ Pipeline completed! Received {len(response_chunks)} chunks")
    print(f"📊 Sources found: {len(sources_data) if sources_data else 0} (expected: 0)")
    
    return not query_analysis.needs_context and (len(sources_data) == 0 if sources_data else True)

async def test_performance_comparison():
    """Test performance difference between retrieval vs no-retrieval queries"""
    print("\n🧪 Test 3: Performance comparison")
    print("=" * 60)
    
    import time
    
    # Test queries
    retrieval_query = "What are the key principles of building a monopoly according to the document?"
    no_retrieval_query = "Thank you for that explanation!"
    
    # Test retrieval query timing
    print("⏱️  Testing retrieval query performance...")
    start_time = time.time()
    
    analysis_request = QueryAnalysisRequest(
        user_query=retrieval_query,
        course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user_id="test_user_123"
    )
    
    query_analysis = await process_pre_outbound_pipeline(analysis_request)
    
    outbound_request = OutboundRequest(
        course="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user="test_user_123",
        prompt=retrieval_query,
        snapshot=None
    )
    
    chunk_count = 0
    async for chunk in process_outbound_pipeline_optimized(
        request=outbound_request,
        expanded_query=query_analysis.expanded_query,
        needs_context=query_analysis.needs_context
    ):
        chunk_count += 1
    
    retrieval_time = time.time() - start_time
    print(f"✅ Retrieval query: {retrieval_time*1000:.0f}ms ({chunk_count} chunks)")
    
    # Test no-retrieval query timing
    print("⏱️  Testing no-retrieval query performance...")
    start_time = time.time()
    
    analysis_request = QueryAnalysisRequest(
        user_query=no_retrieval_query,
        course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user_id="test_user_123"
    )
    
    query_analysis = await process_pre_outbound_pipeline(analysis_request)
    
    outbound_request = OutboundRequest(
        course="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user="test_user_123",
        prompt=no_retrieval_query,
        snapshot=None
    )
    
    chunk_count = 0
    async for chunk in process_outbound_pipeline_optimized(
        request=outbound_request,
        expanded_query=query_analysis.expanded_query,
        needs_context=query_analysis.needs_context
    ):
        chunk_count += 1
    
    no_retrieval_time = time.time() - start_time
    print(f"✅ No-retrieval query: {no_retrieval_time*1000:.0f}ms ({chunk_count} chunks)")
    
    # Calculate performance improvement
    if no_retrieval_time > 0:
        speedup = retrieval_time / no_retrieval_time
        print(f"\n📊 Performance Analysis:")
        print(f"   Retrieval time: {retrieval_time*1000:.0f}ms")
        print(f"   No-retrieval time: {no_retrieval_time*1000:.0f}ms")
        print(f"   Speedup for simple queries: {speedup:.1f}x")
        
        return speedup > 1.2  # Expect at least 20% improvement
    
    return True

async def main():
    """Run all integrated outbound pipeline tests"""
    print("🚀 Testing Integrated Outbound Pipeline with Pre-Analysis")
    print("=" * 80)
    
    # Test 1: Query that needs retrieval
    test1_success = await test_retrieval_needed_query()
    
    # Test 2: Query that doesn't need retrieval
    test2_success = await test_no_retrieval_query()
    
    # Test 3: Performance comparison
    test3_success = await test_performance_comparison()
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 INTEGRATED PIPELINE TEST SUMMARY")
    print("=" * 80)
    print(f"✅ Retrieval Query: {'PASS' if test1_success else 'FAIL'}")
    print(f"✅ No-Retrieval Query: {'PASS' if test2_success else 'FAIL'}")
    print(f"✅ Performance Test: {'PASS' if test3_success else 'FAIL'}")
    
    overall_success = test1_success and test2_success and test3_success
    
    if overall_success:
        print("\n🎉 All integrated tests PASSED!")
        print("✅ Pre-outbound analysis working correctly")
        print("✅ Conditional retrieval working correctly")
        print("✅ Performance optimization working correctly")
    else:
        print("\n❌ Some integrated tests FAILED. Check the logs above.")
    
    return overall_success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)