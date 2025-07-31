"""
Embedding module for processing chunked text using Voyage 3.5-lite embeddings.
Takes the output from chunking.py and adds embeddings to each chunk.
Includes MongoDB vector index storage functionality.
"""

import os
from typing import List, Dict, Any, Optional
import voyageai
from pymongo import MongoClient, InsertOne
from pymongo.errors import BulkWriteError
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv()


def get_mongo_client() -> MongoClient:
    """Initialize and return MongoDB client."""
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        raise ValueError("MONGO_URI not found in .env file")
    return MongoClient(mongo_uri)


def embed_chunks(chunks: List[Dict[str, Any]], api_key: str = None) -> List[Dict[str, Any]]:
    """
    Embeds all text fields in chunks using Voyage 3.5-lite with 512 dimensions.
    
    Args:
        chunks: List of chunk dictionaries from chunking.py, each containing a "text" field
        api_key: Optional Voyage API key (defaults to VOYAGE_API_KEY from environment)
    
    Returns:
        List of chunks with updated "embedding" fields
    """
    # Initialize Voyage client
    api_key = api_key or os.getenv('VOYAGE_API_KEY')
    if not api_key:
        raise ValueError("VOYAGE_API_KEY not found. Set it in .env or pass directly")
    
    client = voyageai.Client(api_key=api_key)
    model = "voyage-3.5-lite"
    dimensions = 512
    batch_size = 1000
    
    # Extract texts from chunks
    texts = [chunk["text"] for chunk in chunks]
    
    # Process in batches if needed
    embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        
        result = client.embed(
            texts=batch,
            model=model,
            input_type="document",
            output_dimension=dimensions
        )
        
        embeddings.extend(result.embeddings)
    
    # Update chunks with embeddings
    for i, chunk in enumerate(chunks):
        chunk["embedding"] = embeddings[i]
    
    return chunks


def save_to_mongodb(chunks: List[Dict[str, Any]], 
                   mongo_client: Optional[MongoClient] = None,
                   batch_size: int = 100) -> Dict[str, Any]:
    """
    Save chunks with embeddings to MongoDB with vector index.
    
    Args:
        chunks: List of chunk dictionaries with embeddings
        mongo_client: Optional MongoClient instance (creates new if not provided)
        batch_size: Number of documents to insert/update in each batch
    
    Returns:
        Dictionary with save statistics
    """
    # Get MongoDB configuration
    db_name = os.getenv('MONGO_DB')
    collection_name = os.getenv('MONGO_COLLECTION_NAME')
    
    if not db_name or not collection_name:
        raise ValueError("MONGO_DB and MONGO_COLLECTION_NAME must be set in .env")
    
    # Initialize MongoDB client if not provided
    if mongo_client is None:
        mongo_client = get_mongo_client()
    
    # Get database and collection
    db = mongo_client[db_name]
    collection = db[collection_name]
    
    # Prepare bulk operations
    operations = []
    
    for chunk in chunks:
        # Use the provided identifier format: {course_id}:{slide_id}:{chunk_index}
        doc_id = f"{chunk['course_id']}:{chunk['slide_id']}:{chunk['chunk_index']}"
        
        # Prepare document for MongoDB
        document = {
            "_id": doc_id,
            "course_id": chunk["course_id"],
            "slide_id": chunk["slide_id"],
            "chunk_index": chunk["chunk_index"],
            "text": chunk["text"],
            "embedding": chunk["embedding"],
            "word_count": chunk["word_count"],
            "char_count": chunk["char_count"],
            "split_level": chunk["split_level"],
            "page_start": chunk["page_start"],
            "page_end": chunk["page_end"],
            "headers_hierarchy": chunk["headers_hierarchy"],
            "headers_hierarchy_titles": chunk["headers_hierarchy_titles"],
            "s3_file_name": chunk["s3_file_name"],
            "total_pages": chunk["total_pages"],
            "timestamp": chunk["timestamp"],
            "sentence_sibling_count": chunk["sentence_sibling_count"],
            "sentence_sibling_index": chunk["sentence_sibling_index"],
            "updated_at": time.time()
        }
        
        # Add optional fields if they exist
        if "is_header" in chunk:
            document["is_header"] = chunk["is_header"]
        if "header_level" in chunk:
            document["header_level"] = chunk["header_level"]
        if "header_text" in chunk:
            document["header_text"] = chunk["header_text"]
        
        # Create insert operation
        operation = InsertOne(document)
        operations.append(operation)
    
    # Execute bulk operations in batches
    stats = {
        "total_chunks": len(chunks),
        "inserted": 0,
        "errors": [],
        "duplicates": 0
    }
    
    for i in range(0, len(operations), batch_size):
        batch_ops = operations[i:i + batch_size]
        
        try:
            result = collection.bulk_write(batch_ops, ordered=False)
            stats["inserted"] += result.inserted_count
        except BulkWriteError as e:
            # Count successful inserts from partial results
            if hasattr(e, 'details') and e.details:
                stats["inserted"] += e.details.get('nInserted', 0)
                # Count duplicate key errors
                write_errors = e.details.get('writeErrors', [])
                for error in write_errors:
                    if error.get('code') == 11000:  # Duplicate key error
                        stats["duplicates"] += 1
            
            stats["errors"].append({
                "batch_start": i,
                "batch_end": min(i + batch_size, len(operations)),
                "error": str(e)
            })
    
    return stats


def embed_and_save(chunks: List[Dict[str, Any]], 
                   api_key: str = None,
                   mongo_client: Optional[MongoClient] = None) -> Dict[str, Any]:
    """
    Convenience function to embed chunks and save to MongoDB in one operation.
    
    Args:
        chunks: List of chunk dictionaries from chunking.py
        api_key: Optional Voyage API key
        mongo_client: Optional MongoClient instance
    
    Returns:
        Dictionary with operation statistics
    """
    # Embed chunks
    start_time = time.time()
    chunks_with_embeddings = embed_chunks(chunks, api_key)
    embedding_time = time.time() - start_time
    
    # Save to MongoDB
    start_time = time.time()
    save_stats = save_to_mongodb(chunks_with_embeddings, mongo_client)
    save_time = time.time() - start_time
    
    # Return combined statistics
    return {
        "embedding_stats": {
            "chunks_embedded": len(chunks_with_embeddings),
            "embedding_time": embedding_time
        },
        "save_stats": save_stats,
        "save_time": save_time,
        "total_time": embedding_time + save_time
    }