#!/usr/bin/env python3
"""
Test script for the pre-outbound pipeline - intelligent query analysis
"""

import sys
import asyncio
import json

# Add the app directory to Python path
sys.path.append('/Users/tomasgodoypastore/Downloads/lectura-app/ai-services/pdf-project')

from app.pre_outbound import (
    QueryAnalysisRequest,
    process_pre_outbound_pipeline,
    analyze_query_intent,
    _fallback_analysis
)

async def test_query_analysis():
    """Test various types of queries to validate the analysis logic"""
    print("🧪 Testing Pre-Outbound Query Analysis Pipeline")
    print("=" * 60)
    
    test_cases = [
        {
            "query": "What is a monopoly in business?",
            "expected_needs_context": True,
            "description": "Information-seeking question about business concepts"
        },
        {
            "query": "Can you explain that in simpler terms?",
            "expected_needs_context": False,
            "description": "Follow-up question asking for clarification"
        },
        {
            "query": "How do I build a successful startup according to the book?",
            "expected_needs_context": True,
            "description": "Specific question referencing document content"
        },
        {
            "query": "Thank you, that was very helpful!",
            "expected_needs_context": False,
            "description": "Social acknowledgment/gratitude"
        },
        {
            "query": "What does Peter Thiel say about competition vs monopolies?",
            "expected_needs_context": True,
            "description": "Specific author/content question"
        },
        {
            "query": "I don't understand what you mean",
            "expected_needs_context": False,
            "description": "Confusion/clarification request"
        },
        {
            "query": "Hello, how are you today?",
            "expected_needs_context": False,
            "description": "Greeting/social interaction"
        },
        {
            "query": "What are the different types of business strategies mentioned?",
            "expected_needs_context": True,
            "description": "Question about specific content categories"
        }
    ]
    
    print(f"Testing {len(test_cases)} different query types...\n")
    
    correct_predictions = 0
    total_tests = len(test_cases)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"Test {i}: {test_case['description']}")
        print(f"Query: \"{test_case['query']}\"")
        
        try:
            # Test direct analysis function
            analysis = await analyze_query_intent(test_case['query'])
            
            print(f"✅ Analysis Result:")
            print(f"   Needs context: {analysis.needs_context}")
            print(f"   Expanded query: \"{analysis.expanded_query}\"")
            print(f"   Reasoning: {analysis.reasoning}")
            
            # Check if prediction matches expectation
            if analysis.needs_context == test_case['expected_needs_context']:
                print(f"✅ CORRECT prediction")
                correct_predictions += 1
            else:
                print(f"❌ INCORRECT prediction (expected: {test_case['expected_needs_context']})")
            
        except Exception as e:
            print(f"❌ Error in analysis: {str(e)}")
            
            # Test fallback analysis
            print("🔄 Testing fallback analysis...")
            fallback = _fallback_analysis(test_case['query'])
            print(f"   Fallback needs context: {fallback.needs_context}")
            print(f"   Fallback reasoning: {fallback.reasoning}")
        
        print("-" * 50)
    
    # Summary
    accuracy = (correct_predictions / total_tests) * 100
    print(f"\n📊 Test Summary:")
    print(f"   Correct predictions: {correct_predictions}/{total_tests}")
    print(f"   Accuracy: {accuracy:.1f}%")
    
    return accuracy >= 70  # Consider 70% accuracy as success

async def test_full_pre_outbound_pipeline():
    """Test the complete pre-outbound pipeline with a real request"""
    print("\n🚀 Testing Full Pre-Outbound Pipeline")
    print("=" * 60)
    
    # Test request
    test_request = QueryAnalysisRequest(
        user_query="What does the document say about building monopolies vs competitive advantages?",
        course_id="test_course_123",
        user_id="test_user_456"
    )
    
    print(f"📝 Test Request:")
    print(f"   User: {test_request.user_id}")
    print(f"   Course: {test_request.course_id}")
    print(f"   Query: \"{test_request.user_query}\"")
    
    try:
        # Process the request
        result = await process_pre_outbound_pipeline(test_request)
        
        print(f"\n✅ Pipeline Result:")
        print(f"   Needs context: {result.needs_context}")
        print(f"   Expanded query: \"{result.expanded_query}\"")
        print(f"   Reasoning: {result.reasoning}")
        
        # Validate result structure
        assert hasattr(result, 'needs_context'), "Missing needs_context field"
        assert hasattr(result, 'expanded_query'), "Missing expanded_query field"
        assert hasattr(result, 'reasoning'), "Missing reasoning field"
        assert isinstance(result.needs_context, bool), "needs_context must be boolean"
        assert isinstance(result.expanded_query, str), "expanded_query must be string"
        assert isinstance(result.reasoning, str), "reasoning must be string"
        
        print(f"\n✅ Full pipeline test PASSED!")
        return True
        
    except Exception as e:
        print(f"\n❌ Full pipeline test FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_edge_cases():
    """Test edge cases and error handling"""
    print("\n🔧 Testing Edge Cases")
    print("=" * 60)
    
    edge_cases = [
        {"query": "", "description": "Empty query"},
        {"query": "   ", "description": "Whitespace-only query"},
        {"query": "a", "description": "Single character query"},
        {"query": "?" * 1000, "description": "Very long query (1000 chars)"},
        {"query": "Query with émojis 🤔 and spëcial çharåcters", "description": "Unicode/special characters"}
    ]
    
    passed_tests = 0
    
    for test_case in edge_cases:
        print(f"\nTesting: {test_case['description']}")
        print(f"Query: \"{test_case['query'][:100]}{'...' if len(test_case['query']) > 100 else ''}\"")
        
        try:
            analysis = await analyze_query_intent(test_case['query'])
            print(f"✅ Handled successfully:")
            print(f"   Needs context: {analysis.needs_context}")
            print(f"   Reasoning: {analysis.reasoning[:100]}...")
            passed_tests += 1
            
        except Exception as e:
            print(f"❌ Failed: {str(e)}")
    
    print(f"\n📊 Edge Case Summary: {passed_tests}/{len(edge_cases)} passed")
    return passed_tests == len(edge_cases)

async def main():
    """Run all pre-outbound pipeline tests"""
    print("🧪 Starting Pre-Outbound Pipeline Test Suite")
    print("=" * 80)
    
    # Test 1: Query analysis accuracy
    analysis_success = await test_query_analysis()
    
    # Test 2: Full pipeline functionality
    pipeline_success = await test_full_pre_outbound_pipeline()
    
    # Test 3: Edge cases and error handling
    edge_case_success = await test_edge_cases()
    
    # Final summary
    print("\n" + "=" * 80)
    print("📊 TEST SUITE SUMMARY")
    print("=" * 80)
    print(f"✅ Query Analysis: {'PASS' if analysis_success else 'FAIL'}")
    print(f"✅ Full Pipeline: {'PASS' if pipeline_success else 'FAIL'}")
    print(f"✅ Edge Cases: {'PASS' if edge_case_success else 'FAIL'}")
    
    overall_success = analysis_success and pipeline_success and edge_case_success
    
    if overall_success:
        print("\n🎉 All tests PASSED! Pre-outbound pipeline is working correctly.")
    else:
        print("\n❌ Some tests FAILED. Please review the issues above.")
    
    return overall_success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)