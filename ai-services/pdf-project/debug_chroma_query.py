#!/usr/bin/env python3
"""
Debug ChromaDB query to see why no results are returned
"""

import sys
import asyncio

sys.path.append('/Users/tomasgodoypastore/Downloads/lectura-app/ai-services/pdf-project')

from app.chroma_client import get_chroma_collection
from app.local_embedding import get_text_embedding

async def debug_chroma_query():
    """Debug ChromaDB query to understand why no results are returned"""
    print("🔧 Debugging ChromaDB Query...")
    
    try:
        # Get collection
        collection = get_chroma_collection()
        
        # Get sample data to understand structure
        sample_data = collection.get(limit=5)
        print(f"📊 Sample data structure:")
        print(f"   IDs: {len(sample_data['ids'])} documents")
        print(f"   Has embeddings: {'embeddings' in sample_data}")
        print(f"   Has metadatas: {'metadatas' in sample_data}")
        
        if sample_data['metadatas']:
            sample_metadata = sample_data['metadatas'][0]
            print(f"   Sample metadata keys: {list(sample_metadata.keys())}")
            print(f"   Sample courseId: {sample_metadata.get('courseId')}")
        
        # Test query with actual course ID
        actual_course_id = "7f36bacc-3b9d-4c50-9d66-a52f98dd12a9"
        
        # Generate embedding for test query
        test_query = "What is a monopoly?"
        query_embedding = get_text_embedding(test_query)
        print(f"\n🔍 Testing query: '{test_query}'")
        print(f"   Embedding dimensions: {len(query_embedding)}")
        print(f"   Course ID: {actual_course_id}")
        
        # Query without filters first
        print("\n📋 Query 1: No filters")
        results1 = collection.query(
            query_embeddings=[query_embedding],
            n_results=5,
            include=["metadatas", "distances", "documents"]
        )
        
        print(f"   Results found: {len(results1['metadatas'][0]) if results1['metadatas'] else 0}")
        if results1['distances'] and results1['distances'][0]:
            print(f"   Top 3 distances: {results1['distances'][0][:3]}")
            print(f"   Top 3 scores: {[1.0/(1.0+d) for d in results1['distances'][0][:3]]}")
        
        # Query with course filter
        print(f"\n📋 Query 2: With course filter '{actual_course_id}'")
        results2 = collection.query(
            query_embeddings=[query_embedding],
            n_results=5,
            where={"courseId": actual_course_id},
            include=["metadatas", "distances", "documents"]
        )
        
        print(f"   Results found: {len(results2['metadatas'][0]) if results2['metadatas'] else 0}")
        if results2['distances'] and results2['distances'][0]:
            print(f"   Top 3 distances: {results2['distances'][0][:3]}")
            print(f"   Top 3 scores: {[1.0/(1.0+d) for d in results2['distances'][0][:3]]}")
        
        # Show actual results with different thresholds
        thresholds = [0.1, 0.2, 0.3, 0.4, 0.5]
        print(f"\n📊 Results by threshold:")
        
        if results2['distances'] and results2['distances'][0]:
            for threshold in thresholds:
                count = 0
                for distance in results2['distances'][0]:
                    score = 1.0 / (1.0 + distance)
                    if score >= threshold:
                        count += 1
                print(f"   Threshold {threshold}: {count} results")
        
        # Show the actual content of top matches
        print(f"\n📄 Top 3 matches content:")
        if results2['metadatas'] and results2['metadatas'][0]:
            for i, metadata in enumerate(results2['metadatas'][0][:3]):
                distance = results2['distances'][0][i]
                score = 1.0 / (1.0 + distance)
                text = metadata.get('rawText', 'No text')[:200]
                print(f"   Match {i+1}: Score={score:.3f}, Distance={distance:.3f}")
                print(f"            Text: {text}...")
                print()
        
        return results2
        
    except Exception as e:
        print(f"❌ Error in debug: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

async def test_fixed_query():
    """Test query with lowered threshold"""
    print("\n🧪 Testing with lowered similarity threshold...")
    
    from app.chroma_client import chroma_query_vectors
    
    # Temporarily patch the function to use lower threshold
    import app.chroma_client as chroma_module
    
    def patched_chroma_query_vectors(collection, query_embedding, course_id, top_k=10):
        """Patched version with lower threshold"""
        try:
            logger = chroma_module.logger
            logger.info(f"🔍 [PATCHED] Querying ChromaDB for top {top_k} vectors (course: {course_id})")
            
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where={"courseId": course_id},
                include=["metadatas", "distances", "documents"]
            )
            
            formatted_results = []
            if results["metadatas"] and results["metadatas"][0]:
                for i, metadata in enumerate(results["metadatas"][0]):
                    distance = results["distances"][0][i] if results["distances"] else 1.0
                    score = 1.0 / (1.0 + distance)
                    
                    # LOWERED THRESHOLD from 0.3 to 0.05
                    if score >= 0.05:
                        formatted_results.append({
                            "score": score,
                            "metadata": metadata
                        })
                        logger.info(f"📄 [PATCHED] Found match: score={score:.3f}, slide={metadata.get('slideId', 'unknown')}")
            
            logger.info(f"✅ [PATCHED] Retrieved {len(formatted_results)} relevant vectors from ChromaDB")
            return formatted_results
            
        except Exception as e:
            logger.error(f"❌ Error retrieving vectors from ChromaDB: {str(e)}")
            return []
    
    # Test the patched version
    collection = get_chroma_collection()
    course_id = "7f36bacc-3b9d-4c50-9d66-a52f98dd12a9"
    query = "What does Peter Thiel say about monopolies and competition?"
    
    query_embedding = get_text_embedding(query)
    results = patched_chroma_query_vectors(collection, query_embedding, course_id, 5)
    
    print(f"✅ Patched query returned: {len(results)} results")
    for i, result in enumerate(results[:3], 1):
        metadata = result['metadata']
        score = result['score']
        text = metadata.get('rawText', 'No text')[:200]
        print(f"   {i}. Score: {score:.3f}")
        print(f"      Slide: {metadata.get('slideId')}")
        print(f"      Pages: {metadata.get('pageStart')}-{metadata.get('pageEnd')}")
        print(f"      Text: {text}...")
        print()
    
    return len(results) > 0

async def main():
    """Run debugging tests"""
    print("🔧 Starting ChromaDB Query Debug...")
    
    # Debug the query
    results = await debug_chroma_query()
    
    # Test with fixed threshold
    success = await test_fixed_query()
    
    print(f"\n✅ Debug complete. Fixed query successful: {success}")

if __name__ == "__main__":
    asyncio.run(main())