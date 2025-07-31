"""
Simple embedding setup for Voyage 3.5-lite with 512 dimensions
"""

import os
from typing import List
import voyageai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class VoyageEmbedder:
    """Simple wrapper for Voyage 3.5-lite embeddings"""
    
    def __init__(self, api_key: str = None):
        """Initialize Voyage client"""
        self.api_key = api_key or os.getenv('VOYAGE_API_KEY')
        if not self.api_key:
            raise ValueError("VOYAGE_API_KEY not found. Set it in .env or pass directly")
        
        self.client = voyageai.Client(api_key=self.api_key)
        self.model = "voyage-3.5-lite"
        self.dimensions = 512
        
    def embed_texts(self, texts: List[str], batch_size: int = 1000) -> List[List[float]]:
        """
        Embed a list of texts
        
        Args:
            texts: List of text strings to embed
            batch_size: Number of texts to process at once (default 1000)
                       With 350-word chunks, 1000 is safe (uses ~467K of 1M token limit)
            
        Returns:
            List of embedding vectors
        """
        embeddings = []
        
        # Process in batches
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            result = self.client.embed(
                texts=batch,
                model=self.model,
                input_type="document",
                output_dimension=self.dimensions
            )
            
            embeddings.extend(result.embeddings)
            
        return embeddings
    
    def embed_query(self, query: str) -> List[float]:
        """
        Embed a single query (optimized for search)
        
        Args:
            query: Query text string
            
        Returns:
            Embedding vector
        """
        result = self.client.embed(
            texts=[query],
            model=self.model,
            input_type="query",
            output_dimension=self.dimensions
        )
        
        return result.embeddings[0]


# Example usage
if __name__ == "__main__":
    # Initialize embedder
    embedder = VoyageEmbedder()
    
    # Example documents
    documents = [
        "The quick brown fox jumps over the lazy dog",
        "Machine learning is transforming how we process text",
        "Embeddings capture semantic meaning in vector space"
    ]
    
    # Embed documents
    print("Embedding documents...")
    doc_embeddings = embedder.embed_texts(documents)
    print(f"Created {len(doc_embeddings)} embeddings of dimension {len(doc_embeddings[0])}")
    
    # Embed a query
    query = "What is machine learning?"
    print(f"\nEmbedding query: '{query}'")
    query_embedding = embedder.embed_query(query)
    print(f"Query embedding dimension: {len(query_embedding)}")
    
    # Simple similarity calculation (cosine similarity)
    import numpy as np
    
    def cosine_similarity(a, b):
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    
    print("\nSimilarity scores:")
    for i, doc in enumerate(documents):
        similarity = cosine_similarity(query_embedding, doc_embeddings[i])
        print(f"  '{doc[:50]}...' : {similarity:.3f}")