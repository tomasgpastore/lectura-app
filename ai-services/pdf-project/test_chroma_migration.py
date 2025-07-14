#!/usr/bin/env python3
"""
Test script to verify ChromaDB migration works correctly
"""

import os
import sys

# Add the app directory to Python path
sys.path.append('/Users/tomasgodoypastore/Downloads/lectura-app/ai-services/pdf-project')

from app.chroma_client import get_chroma_collection, safe_chroma_upsert, chroma_query_vectors, cleanup_chroma_client
from app.local_embedding import get_text_embedding

def test_chroma_migration():
    print("🧪 Testing ChromaDB migration...")
    
    try:
        # Test 1: Initialize ChromaDB collection
        print("\n1. Testing ChromaDB collection initialization...")
        collection = get_chroma_collection("test_collection")
        print(f"✅ ChromaDB collection initialized: {collection.name}")
        
        # Test 2: Generate test embeddings
        print("\n2. Testing local embedding generation...")
        test_texts = [
            "This is a test document about machine learning.",
            "Python is a programming language used for AI development.",
            "ChromaDB is a vector database for storing embeddings."
        ]
        
        test_vectors = []
        for i, text in enumerate(test_texts):
            embedding = get_text_embedding(text)
            print(f"   Generated embedding for text {i+1}: {len(embedding)} dimensions")
            
            test_vectors.append({
                "id": f"test_doc_{i+1}",
                "values": embedding,
                "metadata": {
                    "courseId": "test_course",
                    "slideId": f"slide_{i+1}",
                    "s3_path": f"test_file_{i+1}.pdf",
                    "pageStart": 1,
                    "pageEnd": 1,
                    "rawText": text,
                    "chunk_index": i
                }
            })
        
        # Test 3: Upload vectors to ChromaDB
        print("\n3. Testing ChromaDB vector upload...")
        success = safe_chroma_upsert(collection, test_vectors)
        if success:
            print(f"✅ Successfully uploaded {len(test_vectors)} test vectors")
        else:
            print("❌ Failed to upload vectors")
            return False
        
        # Test 4: Query vectors from ChromaDB
        print("\n4. Testing ChromaDB vector query...")
        query_text = "What is machine learning?"
        query_embedding = get_text_embedding(query_text)
        
        results = chroma_query_vectors(collection, query_embedding, "test_course", top_k=3)
        print(f"✅ Query returned {len(results)} results")
        
        for i, result in enumerate(results):
            print(f"   Result {i+1}: score={result['score']:.3f}, slide={result['metadata'].get('slideId')}")
        
        # Test 5: Cleanup
        print("\n5. Testing cleanup...")
        cleanup_chroma_client()
        print("✅ ChromaDB client cleaned up")
        
        print("\n🎉 All tests passed! ChromaDB migration is working correctly.")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_chroma_migration()
    if success:
        print("\n✅ ChromaDB migration test completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ ChromaDB migration test failed!")
        sys.exit(1)