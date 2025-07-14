from sentence_transformers import SentenceTransformer
from typing import List, Optional
import logging
import os

logger = logging.getLogger(__name__)

_local_embedding_model: Optional[SentenceTransformer] = None

def get_local_embedding_model() -> SentenceTransformer:
    """Get or create local embedding model (singleton)"""
    global _local_embedding_model
    if _local_embedding_model is None:
        model_path = "/Users/tomasgodoypastore/Downloads/lectura-app/ai-services/pdf-project/multilingual-minilm-local"
        
        if not os.path.exists(model_path):
            raise ValueError(f"Local embedding model not found at: {model_path}")
        
        logger.info(f"Loading local embedding model from: {model_path}")
        # Force CPU usage to avoid MPS tensor issues on Apple Silicon
        _local_embedding_model = SentenceTransformer(model_path, device='cpu')
        logger.info("✅ Local embedding model initialized (using CPU)")
    
    return _local_embedding_model

def get_text_embedding(text: str) -> List[float]:
    """Get embedding for a single text"""
    model = get_local_embedding_model()
    embedding = model.encode(text, convert_to_tensor=False)
    return embedding.tolist()

def get_text_embedding_batch(texts: List[str]) -> List[List[float]]:
    """Get embeddings for a batch of texts"""
    model = get_local_embedding_model()
    embeddings = model.encode(texts, convert_to_tensor=False)
    return [embedding.tolist() for embedding in embeddings]

def cleanup_local_embedding_model():
    """Clean up local embedding model on shutdown"""
    global _local_embedding_model
    _local_embedding_model = None
    logger.info("Local embedding model cleaned up")