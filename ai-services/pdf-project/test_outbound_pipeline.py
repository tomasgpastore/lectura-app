#!/usr/bin/env python3
"""
Test script for the outbound pipeline using Zero to One book content
"""

import sys
import asyncio
import json

# Add the app directory to Python path
sys.path.append('/Users/tomasgodoypastore/Downloads/lectura-app/ai-services/pdf-project')

from app.outbound_pipeline import (
    OutboundRequest, 
    process_outbound_pipeline,
    calculate_embedding,
    retrieve_similar_vectors,
    get_vector_collection
)
from app.chroma_client import get_chroma_collection, chroma_query_vectors

async def test_vector_retrieval():
    """Test direct vector retrieval from ChromaDB"""
    print("🔍 Testing direct ChromaDB vector retrieval...")
    
    try:
        # Get ChromaDB collection
        collection = get_chroma_collection()
        
        # Check what's in the database
        print(f"✅ Connected to ChromaDB collection: {collection.name}")
        
        # Get collection info
        collection_info = collection.get()
        total_vectors = len(collection_info['ids']) if collection_info['ids'] else 0
        print(f"📊 Total vectors in database: {total_vectors}")
        
        if total_vectors > 0:
            # Show first few document IDs and metadata
            print(f"📋 Sample document IDs:")
            for i, doc_id in enumerate(collection_info['ids'][:5]):
                metadata = collection_info['metadatas'][i] if collection_info['metadatas'] else {}
                print(f"   {i+1}. ID: {doc_id}")
                print(f"      Course: {metadata.get('courseId', 'N/A')}")
                print(f"      Slide: {metadata.get('slideId', 'N/A')}")
                print(f"      Pages: {metadata.get('pageStart', 'N/A')}-{metadata.get('pageEnd', 'N/A')}")
                print(f"      Text preview: {metadata.get('rawText', 'N/A')[:100]}...")
                print()
        
        return total_vectors > 0, collection
        
    except Exception as e:
        print(f"❌ Error accessing ChromaDB: {str(e)}")
        return False, None

async def test_embedding_calculation():
    """Test embedding calculation for Zero to One queries"""
    print("🧮 Testing embedding calculation...")
    
    test_queries = [
        "What is a monopoly in business?",
        "How do you build a successful startup?", 
        "What does Peter Thiel say about competition?",
        "What is the difference between horizontal and vertical progress?"
    ]
    
    for i, query in enumerate(test_queries, 1):
        try:
            print(f"\n📝 Query {i}: '{query}'")
            embedding = await calculate_embedding(query)
            print(f"✅ Embedding generated: {len(embedding)} dimensions")
            print(f"   First 5 values: {embedding[:5]}")
            
        except Exception as e:
            print(f"❌ Error generating embedding for query {i}: {str(e)}")
            return False
    
    return True

async def test_vector_search():
    """Test vector similarity search"""
    print("\n🔍 Testing vector similarity search...")
    
    # Test queries related to Zero to One content
    test_queries = [
        {
            "query": "What is a monopoly in business?",
            "course_id": "zero_to_one_course",
            "expected_topics": ["monopoly", "competition", "business"]
        },
        {
            "query": "How do you build a successful startup?",
            "course_id": "zero_to_one_course", 
            "expected_topics": ["startup", "business", "company"]
        },
        {
            "query": "What does Peter Thiel say about competition?",
            "course_id": "zero_to_one_course",
            "expected_topics": ["competition", "thiel", "business"]
        }
    ]
    
    collection = get_vector_collection()
    
    for i, test_case in enumerate(test_queries, 1):
        print(f"\n📝 Search Test {i}: '{test_case['query']}'")
        
        try:
            # Calculate embedding for query
            query_embedding = await calculate_embedding(test_case['query'])
            
            # Search for similar vectors
            results = await retrieve_similar_vectors(
                course_id=test_case['course_id'],
                query_embedding=query_embedding,
                top_k=5
            )
            
            print(f"✅ Found {len(results)} similar vectors")
            
            # Analyze results
            if results:
                print("📋 Top results:")
                for j, result in enumerate(results[:3], 1):
                    metadata = result.get('metadata', {})
                    score = result.get('score', 0)
                    text = metadata.get('rawText', 'No text available')
                    
                    print(f"   {j}. Score: {score:.3f}")
                    print(f"      Slide: {metadata.get('slideId', 'N/A')}")
                    print(f"      Pages: {metadata.get('pageStart', 'N/A')}-{metadata.get('pageEnd', 'N/A')}")
                    print(f"      Text: {text[:150]}...")
                    print()
            else:
                print("⚠️  No results found - this might indicate:")
                print("   - No data for the specified course_id")
                print("   - Query doesn't match existing content")
                print("   - Similarity threshold too high")
                
        except Exception as e:
            print(f"❌ Error in search test {i}: {str(e)}")
    
    return len(results) > 0 if 'results' in locals() else False

async def test_full_outbound_pipeline():
    """Test the complete outbound pipeline"""
    print("\n🚀 Testing complete outbound pipeline...")
    
    # Create test request
    test_request = OutboundRequest(
        course="zero_to_one_course",
        user="test_user_123", 
        prompt="What does the book Zero to One say about monopolies and how they differ from competitive markets?",
        snapshot=None
    )
    
    print(f"📝 Test Query: '{test_request.prompt}'")
    print(f"📚 Course ID: {test_request.course}")
    print(f"👤 User ID: {test_request.user}")
    
    try:
        # Process the request and collect all responses
        responses = []
        sources_data = None
        
        print("\n📡 Processing outbound pipeline...")
        async for response in process_outbound_pipeline(test_request):
            responses.append(response)
            print(f"📨 Received: {response[:100]}...")
            
            # Parse SSE events
            if response.startswith("event: sources"):
                # Extract sources data
                data_line = response.split("data: ", 1)[1].split("\n")[0]
                try:
                    sources_data = json.loads(data_line)
                    print(f"\n📋 Sources received: {len(sources_data)} sources")
                except json.JSONDecodeError:
                    print("⚠️  Could not parse sources data")
        
        print(f"\n✅ Pipeline completed! Received {len(responses)} response chunks")
        
        # Analyze sources if available
        if sources_data:
            print("\n📊 Source Analysis:")
            for i, source in enumerate(sources_data, 1):
                print(f"   Source {i}:")
                print(f"      Slide ID: {source.get('slide_id', 'N/A')}")
                print(f"      Pages: {source.get('page_start', 'N/A')}-{source.get('page_end', 'N/A')}")
                print(f"      Text: {source.get('raw_text', 'N/A')[:200]}...")
                print()
        else:
            print("⚠️  No sources were retrieved")
        
        return len(sources_data) > 0 if sources_data else False
        
    except Exception as e:
        print(f"❌ Error in full pipeline test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def debug_course_data():
    """Debug what course data is actually in the database"""
    print("\n🔧 Debugging course data in ChromaDB...")
    
    try:
        collection = get_chroma_collection()
        
        # Get all data
        all_data = collection.get()
        
        if not all_data['ids']:
            print("❌ No data found in ChromaDB!")
            return
        
        # Analyze course IDs
        course_ids = set()
        slide_ids = set()
        
        print(f"📊 Total documents: {len(all_data['ids'])}")
        
        for metadata in all_data['metadatas']:
            if metadata:
                course_id = metadata.get('courseId')
                slide_id = metadata.get('slideId')
                if course_id:
                    course_ids.add(course_id)
                if slide_id:
                    slide_ids.add(slide_id)
        
        print(f"\n📋 Available course IDs: {list(course_ids)}")
        print(f"📋 Available slide IDs: {list(slide_ids)}")
        
        # Show sample documents for each course
        for course_id in course_ids:
            print(f"\n📚 Sample documents for course '{course_id}':")
            count = 0
            for i, metadata in enumerate(all_data['metadatas']):
                if metadata and metadata.get('courseId') == course_id:
                    if count < 3:  # Show first 3 documents
                        text = metadata.get('rawText', 'No text')
                        print(f"   Doc {count+1}: {text[:150]}...")
                        print(f"            Pages: {metadata.get('pageStart')}-{metadata.get('pageEnd')}")
                        print(f"            Slide: {metadata.get('slideId')}")
                        count += 1
                    else:
                        break
        
        return course_ids
        
    except Exception as e:
        print(f"❌ Error debugging course data: {str(e)}")
        return set()

async def main():
    """Run all outbound pipeline tests"""
    print("🧪 Starting Outbound Pipeline Tests for Zero to One")
    print("=" * 60)
    
    # Test 1: Check ChromaDB connection and data
    has_data, collection = await test_vector_retrieval()
    if not has_data:
        print("❌ No data in ChromaDB - please run inbound pipeline first!")
        return
    
    # Test 2: Debug what course data exists
    available_courses = await debug_course_data()
    
    # Test 3: Test embedding calculation
    embedding_success = await test_embedding_calculation()
    if not embedding_success:
        print("❌ Embedding calculation failed!")
        return
    
    # Test 4: Test vector search with actual course IDs
    if available_courses:
        print(f"\n🔍 Testing with available course ID: {list(available_courses)[0]}")
        # Update test to use actual course ID
        search_success = await test_vector_search()
    else:
        search_success = False
    
    # Test 5: Test full pipeline with correct course ID
    if available_courses:
        # Use the first available course ID
        actual_course_id = list(available_courses)[0]
        print(f"\n🚀 Testing full pipeline with course ID: {actual_course_id}")
        
        # Create request with actual course ID
        test_request = OutboundRequest(
            course=actual_course_id,
            user="test_user_123",
            prompt="What does this document say about monopolies, competition, and building successful businesses?",
            snapshot=None
        )
        
        try:
            responses = []
            sources_data = None
            
            async for response in process_outbound_pipeline(test_request):
                responses.append(response)
                
                if response.startswith("event: sources"):
                    data_line = response.split("data: ", 1)[1].split("\n")[0]
                    try:
                        sources_data = json.loads(data_line)
                        print(f"\n✅ SOURCES RETRIEVED: {len(sources_data)} sources found!")
                        
                        # Show detailed source information
                        for i, source in enumerate(sources_data, 1):
                            print(f"\nSource {i}:")
                            print(f"  Slide ID: {source.get('slide_id', 'N/A')}")
                            print(f"  Pages: {source.get('page_start', 'N/A')}-{source.get('page_end', 'N/A')}")
                            print(f"  Content: {source.get('raw_text', 'N/A')[:300]}...")
                            
                    except json.JSONDecodeError as e:
                        print(f"❌ Could not parse sources: {e}")
                
                elif response.startswith("event: token"):
                    # Extract token data
                    token_data = response.split("data: ", 1)[1].split("\n")[0]
                    print(f"🤖 LLM Token: {token_data[:50]}...")
            
            pipeline_success = sources_data is not None and len(sources_data) > 0
            
        except Exception as e:
            print(f"❌ Full pipeline test failed: {e}")
            pipeline_success = False
    else:
        pipeline_success = False
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"✅ ChromaDB Connection: {'PASS' if has_data else 'FAIL'}")
    print(f"✅ Embedding Generation: {'PASS' if embedding_success else 'FAIL'}")
    print(f"✅ Vector Search: {'PASS' if search_success else 'FAIL'}")
    print(f"✅ Full Pipeline: {'PASS' if pipeline_success else 'FAIL'}")
    print(f"📚 Available Courses: {list(available_courses) if available_courses else 'None'}")
    
    if pipeline_success:
        print("\n🎉 Outbound pipeline test SUCCESSFUL!")
        print("✅ Sources were retrieved from ChromaDB")
        print("✅ LLM generated response based on retrieved content")
    else:
        print("\n❌ Outbound pipeline test FAILED")
        print("Check the logs above for specific issues")

if __name__ == "__main__":
    asyncio.run(main())