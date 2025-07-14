from dotenv import load_dotenv
import os
import logging
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

def get_required_env_vars():
    """Get list of required environment variables"""
    # Updated to reflect current architecture: ChromaDB (local), local embeddings, Gemini LLM
    return ['S3_BUCKET_NAME', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'GOOGLE_API_KEY']

def validate_environment():
    """Validate that all required environment variables are set"""
    required_vars = get_required_env_vars()
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {missing_vars}")
        return False, missing_vars
    
    logger.info("All required environment variables are set")
    return True, []

def get_env_var(var_name: str):
    """Get environment variable with optional default"""
    return os.getenv(var_name) 