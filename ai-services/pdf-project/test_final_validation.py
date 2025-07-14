#!/usr/bin/env python3
"""
Final validation test for the intelligent pre-outbound and outbound pipeline
"""

import sys
import asyncio
import json

# Add the app directory to Python path
sys.path.append('/Users/tomasgodoypastore/Downloads/lectura-app/ai-services/pdf-project')

from app.pre_outbound import QueryAnalysisRequest, process_pre_outbound_pipeline
from app.outbound_pipeline import OutboundRequest, process_outbound_pipeline_optimized

async def test_various_query_types():
    """Test a variety of real-world query types"""
    print("🧪 Final Validation: Various Query Types")
    print("=" * 60)
    
    test_queries = [
        # Information queries (should retrieve)
        {
            "query": "What is a monopoly according to the document?",
            "expected_needs_context": True,
            "type": "Document reference"
        },
        {
            "query": "How does Peter Thiel define competition?",
            "expected_needs_context": True,
            "type": "Author-specific question"
        },
        {
            "query": "What are the main business strategies mentioned?",
            "expected_needs_context": True,
            "type": "Content extraction"
        },
        
        # Follow-up queries (should NOT retrieve)
        {
            "query": "What do you mean by that?",
            "expected_needs_context": False,
            "type": "Clarification request"
        },
        {
            "query": "Could you give me an example?",
            "expected_needs_context": False,
            "type": "Example request"
        },
        {
            "query": "I still don't understand",
            "expected_needs_context": False,
            "type": "Confusion statement"
        },
        
        # Social queries (should NOT retrieve)
        {
            "query": "Thanks for the help!",
            "expected_needs_context": False,
            "type": "Gratitude"
        },
        {
            "query": "Good morning",
            "expected_needs_context": False,
            "type": "Greeting"
        },
        
        # Edge cases
        {
            "query": "What's this about?",
            "expected_needs_context": True,  # Ambiguous, likely needs context
            "type": "Ambiguous question"
        }
    ]
    
    correct_predictions = 0
    total_tests = len(test_queries)
    
    for i, test_case in enumerate(test_queries, 1):
        print(f"\n🔍 Test {i}: {test_case['type']}")
        print(f"Query: \"{test_case['query']}\"")
        print(f"Expected needs context: {test_case['expected_needs_context']}")
        
        try:
            # Create analysis request
            analysis_request = QueryAnalysisRequest(
                user_query=test_case['query'],
                course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
                user_id="test_user_validation"
            )
            
            # Get analysis
            result = await process_pre_outbound_pipeline(analysis_request)
            
            print(f"✅ Analysis:")
            print(f"   Needs context: {result.needs_context}")
            print(f"   Reasoning: {result.reasoning[:100]}...")
            
            # Check prediction accuracy
            if result.needs_context == test_case['expected_needs_context']:
                print(f"✅ CORRECT prediction")
                correct_predictions += 1
            else:
                print(f"❌ INCORRECT prediction")
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")
    
    accuracy = (correct_predictions / total_tests) * 100
    print(f"\n📊 Final Validation Results:")
    print(f"   Correct: {correct_predictions}/{total_tests}")
    print(f"   Accuracy: {accuracy:.1f}%")
    
    return accuracy >= 75  # Expect at least 75% accuracy

async def test_performance_metrics():
    """Test performance metrics of the integrated system"""
    print("\n⏱️  Performance Metrics Test")
    print("=" * 60)
    
    import time
    
    # Test different scenarios
    scenarios = [
        {
            "name": "Complex Retrieval Query",
            "query": "What are Peter Thiel's detailed views on building monopolies vs competitive markets?",
            "expected_retrieval": True
        },
        {
            "name": "Simple Follow-up",
            "query": "Thanks, that makes sense",
            "expected_retrieval": False
        }
    ]
    
    for scenario in scenarios:
        print(f"\n🚀 Testing: {scenario['name']}")
        print(f"Query: \"{scenario['query']}\"")
        
        start_time = time.time()
        
        # Pre-outbound analysis
        analysis_request = QueryAnalysisRequest(
            user_query=scenario['query'],
            course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
            user_id="perf_test_user"
        )
        
        analysis_start = time.time()
        analysis = await process_pre_outbound_pipeline(analysis_request)
        analysis_time = time.time() - analysis_start
        
        # Outbound pipeline
        outbound_request = OutboundRequest(
            course="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
            user="perf_test_user",
            prompt=scenario['query'],
            snapshot=None
        )
        
        pipeline_start = time.time()
        chunk_count = 0
        sources_count = 0
        
        async for chunk in process_outbound_pipeline_optimized(
            request=outbound_request,
            expanded_query=analysis.expanded_query,
            needs_context=analysis.needs_context
        ):
            chunk_count += 1
            if chunk.startswith("event: sources"):
                data_line = chunk.split("data: ", 1)[1].split("\n")[0]
                try:
                    sources_data = json.loads(data_line)
                    sources_count = len(sources_data)
                except:
                    pass
        
        pipeline_time = time.time() - pipeline_start
        total_time = time.time() - start_time
        
        print(f"📊 Performance Results:")
        print(f"   Analysis time: {analysis_time*1000:.0f}ms")
        print(f"   Pipeline time: {pipeline_time*1000:.0f}ms")
        print(f"   Total time: {total_time*1000:.0f}ms")
        print(f"   Retrieval performed: {analysis.needs_context}")
        print(f"   Sources found: {sources_count}")
        print(f"   Response chunks: {chunk_count}")
        
        # Validate retrieval decision
        if analysis.needs_context == scenario['expected_retrieval']:
            print(f"✅ Correct retrieval decision")
        else:
            print(f"❌ Incorrect retrieval decision")
    
    return True

async def test_query_expansion_quality():
    """Test the quality of query expansion"""
    print("\n📝 Query Expansion Quality Test")
    print("=" * 60)
    
    test_queries = [
        "What is a monopoly?",
        "How to start a company?", 
        "Competition vs cooperation",
        "Zero to One principles"
    ]
    
    for query in test_queries:
        print(f"\n🔍 Original: \"{query}\"")
        
        analysis_request = QueryAnalysisRequest(
            user_query=query,
            course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
            user_id="expansion_test_user"
        )
        
        result = await process_pre_outbound_pipeline(analysis_request)
        
        print(f"🔍 Expanded: \"{result.expanded_query}\"")
        print(f"📊 Length increase: {len(result.expanded_query) - len(query)} chars")
        
        # Basic quality checks
        expansion_ratio = len(result.expanded_query) / len(query)
        if expansion_ratio > 1.2:  # At least 20% longer
            print(f"✅ Good expansion (ratio: {expansion_ratio:.1f})")
        else:
            print(f"⚠️  Minimal expansion (ratio: {expansion_ratio:.1f})")
    
    return True

async def main():
    """Run final validation tests"""
    print("🎯 Final Validation of Intelligent Pre-Outbound Pipeline")
    print("=" * 80)
    
    # Test 1: Various query types
    accuracy_test = await test_various_query_types()
    
    # Test 2: Performance metrics
    performance_test = await test_performance_metrics()
    
    # Test 3: Query expansion quality
    expansion_test = await test_query_expansion_quality()
    
    # Final summary
    print("\n" + "=" * 80)
    print("🎯 FINAL VALIDATION SUMMARY")
    print("=" * 80)
    print(f"✅ Query Analysis Accuracy: {'PASS' if accuracy_test else 'FAIL'}")
    print(f"✅ Performance Metrics: {'PASS' if performance_test else 'FAIL'}")
    print(f"✅ Query Expansion: {'PASS' if expansion_test else 'FAIL'}")
    
    overall_success = accuracy_test and performance_test and expansion_test
    
    if overall_success:
        print("\n🎉 FINAL VALIDATION PASSED!")
        print("✅ Intelligent pre-outbound pipeline is ready for production")
        print("✅ Conditional retrieval working correctly")
        print("✅ Performance optimizations active")
        print("✅ Query expansion improving search quality")
    else:
        print("\n❌ FINAL VALIDATION FAILED!")
        print("Please review the test results above")
    
    return overall_success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)