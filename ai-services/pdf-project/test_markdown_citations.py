#!/usr/bin/env python3
"""
Test the improved outbound pipeline with markdown responses and source citations
"""

import sys
import asyncio
import json

# Add the app directory to Python path
sys.path.append('/Users/tomasgodoypastore/Downloads/lectura-app/ai-services/pdf-project')

from app.pre_outbound import QueryAnalysisRequest, process_pre_outbound_pipeline
from app.outbound_pipeline import OutboundRequest, process_outbound_pipeline_optimized

async def test_markdown_with_citations():
    """Test markdown responses with source citations"""
    print("🧪 TESTING MARKDOWN RESPONSES WITH SOURCE CITATIONS")
    print("="*80)
    
    # Step 1: Pre-outbound analysis
    analysis_request = QueryAnalysisRequest(
        user_query="What does Peter Thiel say about monopolies vs competition? How do they relate to innovation?",
        course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user_id="markdown_test_user"
    )
    
    query_analysis = await process_pre_outbound_pipeline(analysis_request)
    
    # Step 2: Outbound pipeline with markdown formatting
    outbound_request = OutboundRequest(
        course="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user="markdown_test_user",
        prompt=analysis_request.user_query,
        snapshot=None
    )
    
    print("\n" + "="*80)
    print("📝 COLLECTING MARKDOWN RESPONSE...")
    print("="*80)
    
    # Collect the complete response
    sources_data = None
    markdown_content = ""
    
    async for chunk in process_outbound_pipeline_optimized(
        request=outbound_request,
        expanded_query=query_analysis.expanded_query,
        needs_context=query_analysis.needs_context
    ):
        # Parse sources event
        if chunk.startswith("event: sources"):
            data_line = chunk.split("data: ", 1)[1].split("\n")[0]
            try:
                sources_data = json.loads(data_line)
                print(f"📚 SOURCES RECEIVED: {len(sources_data)} sources")
                for source in sources_data:
                    print(f"  • Source {source['source_id']}: {source['preview_text']}")
            except json.JSONDecodeError:
                print("⚠️  Could not parse sources data")
        
        # Collect markdown tokens
        elif chunk.startswith("event: token"):
            token_data = chunk.split("data: ", 1)[1].split("\n")[0]
            markdown_content += token_data
        
        elif chunk.startswith("event: end"):
            break
    
    print("\n" + "="*80)
    print("📖 COMPLETE MARKDOWN RESPONSE:")
    print("="*80)
    print(markdown_content)
    
    print("\n" + "="*80)
    print("🔍 ANALYZING RESPONSE:")
    print("="*80)
    
    # Check for markdown formatting
    has_headers = "#" in markdown_content
    has_citations = "[📚 Source" in markdown_content and "](source:" in markdown_content
    has_lists = ("- " in markdown_content or "* " in markdown_content or 
                ("1." in markdown_content and "2." in markdown_content))
    
    print(f"✅ Markdown Headers: {'YES' if has_headers else 'NO'}")
    print(f"✅ Source Citations: {'YES' if has_citations else 'NO'}")
    print(f"✅ Lists/Formatting: {'YES' if has_lists else 'NO'}")
    print(f"✅ Sources Available: {'YES' if sources_data else 'NO'}")
    
    if has_citations:
        # Count citations
        citation_count = markdown_content.count("[📚 Source")
        print(f"📊 Citation Count: {citation_count}")
        
        # Show citation examples
        import re
        citations = re.findall(r'\[📚 Source \d+\]\(source:\d+\)', markdown_content)
        print(f"📋 Citation Examples: {citations[:3]}")
    
    print("\n" + "="*80)
    print("🎯 FRONTEND INTEGRATION READY:")
    print("="*80)
    print("• Markdown content can be rendered directly")
    print("• Citations use format: [📚 Source X](source:X)")
    print("• Frontend can detect 'source:' links and create buttons")
    print("• Source metadata available for popup/modal display")
    print("="*80)
    
    return has_headers and has_citations and sources_data is not None

async def test_no_sources_markdown():
    """Test markdown response when no sources are available"""
    print("\n" + "="*80)
    print("🧪 TESTING MARKDOWN WITHOUT SOURCES")
    print("="*80)
    
    # Step 1: Pre-outbound analysis for simple greeting
    analysis_request = QueryAnalysisRequest(
        user_query="Hello! How are you doing today?",
        course_id="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user_id="markdown_test_user"
    )
    
    query_analysis = await process_pre_outbound_pipeline(analysis_request)
    
    # Step 2: Outbound pipeline (should not retrieve sources)
    outbound_request = OutboundRequest(
        course="7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
        user="markdown_test_user",
        prompt=analysis_request.user_query,
        snapshot=None
    )
    
    # Collect response
    markdown_content = ""
    sources_count = 0
    
    async for chunk in process_outbound_pipeline_optimized(
        request=outbound_request,
        expanded_query=query_analysis.expanded_query,
        needs_context=query_analysis.needs_context
    ):
        if chunk.startswith("event: sources"):
            data_line = chunk.split("data: ", 1)[1].split("\n")[0]
            try:
                sources_data = json.loads(data_line)
                sources_count = len(sources_data)
            except:
                pass
        elif chunk.startswith("event: token"):
            token_data = chunk.split("data: ", 1)[1].split("\n")[0]
            markdown_content += token_data
        elif chunk.startswith("event: end"):
            break
    
    print(f"📝 Response: {markdown_content}")
    print(f"📚 Sources: {sources_count} (expected: 0)")
    print(f"🔍 Still Markdown: {'YES' if markdown_content.strip() else 'NO'}")
    
    return sources_count == 0 and len(markdown_content.strip()) > 0

async def main():
    """Run markdown and citation tests"""
    
    # Test 1: Markdown with sources and citations
    test1_success = await test_markdown_with_citations()
    
    # Test 2: Markdown without sources
    test2_success = await test_no_sources_markdown()
    
    print("\n" + "="*80)
    print("📊 TEST SUMMARY")
    print("="*80)
    print(f"✅ Markdown with Citations: {'PASS' if test1_success else 'FAIL'}")
    print(f"✅ Markdown without Sources: {'PASS' if test2_success else 'FAIL'}")
    
    if test1_success and test2_success:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Markdown formatting working")
        print("✅ Source citations implemented")
        print("✅ Frontend integration ready")
        print("✅ Citations format: [📚 Source X](source:X)")
    else:
        print("\n❌ Some tests failed - check the output above")
    
    return test1_success and test2_success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)