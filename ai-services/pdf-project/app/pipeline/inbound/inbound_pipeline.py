from llama_index.readers.file import PyMuPDFReader
from llama_index.core.schema import Document
from app.chunking.semantic_chunking import SemanticChunker
from app.chunking.structural_chunking import StructuralChunker
from app.config import get_env_var
from embedding.local_embedding import get_text_embedding, get_text_embedding_batch, cleanup_local_embedding_model, get_local_embedding_model
from database.chroma_client import get_chroma_collection, safe_chroma_upsert, cleanup_chroma_client
import logging
import time
import fitz
import boto3
import asyncio
from typing import Optional, List, Any, Dict
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor
import re
from functools import lru_cache

# Configure logging for microservice
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Chunking strategy configuration - change this to switch between chunking methods
CHUNKING_STRATEGY = "semantic"  # Options: "semantic", "structural"

# Global connections - initialized once and reused
_chroma_collection = None
_s3_client = None
_thread_pool: Optional[ThreadPoolExecutor] = None
_tokenizer = None
_embedding_model_warmed = False
_semantic_chunker = None
_structural_chunker = None

# Compiled regex patterns for faster chunking
_sentence_pattern = re.compile(r'[.!?]\s+')
_word_boundary_pattern = re.compile(r'\s+')

def get_thread_pool() -> ThreadPoolExecutor:
    """Get or create thread pool for CPU-bound operations"""
    global _thread_pool
    if _thread_pool is None:
        # Increase thread pool size for better parallelism
        _thread_pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix="inbound_")
    return _thread_pool

def get_vector_collection():
    """Get or create ChromaDB collection (singleton)"""
    global _chroma_collection
    if _chroma_collection is None:
        _chroma_collection = get_chroma_collection()
        logger.info("✅ ChromaDB collection initialized (inbound)")
    return _chroma_collection

def get_s3_client():
    """Get or create S3 client (singleton)"""
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client('s3')
        logger.info("S3 client initialized (inbound)")
    return _s3_client

def get_tokenizer():
    """Get or create tokenizer (singleton) - using simple estimation"""
    global _tokenizer
    if _tokenizer is None:
        # Use simple token estimation instead of actual tokenizer
        _tokenizer = "estimator"
        logger.info("Simple token estimator initialized (inbound)")
    return _tokenizer

def get_semantic_chunker():
    """Get or create semantic chunker (singleton)"""
    global _semantic_chunker
    if _semantic_chunker is None:
        # Create custom semantic chunker using our existing embedding model
        _semantic_chunker = SemanticChunker(
            buffer_size=3,  # Number of sentences to group together
            breakpoint_percentile_threshold=90,  # Threshold for semantic breaks
            chunk_size=300,  # Maximum chunk size in tokens
        )
        logger.info("✅ Semantic chunker initialized (inbound)")
    return _semantic_chunker

def get_structural_chunker():
    """Get or create structural chunker (singleton)"""
    global _structural_chunker
    if _structural_chunker is None:
        # Create structural chunker
        _structural_chunker = StructuralChunker(
            chunk_size=300,  # Maximum chunk size in tokens
            overlap_size=50,  # Token overlap between chunks
        )
        logger.info("✅ Structural chunker initialized (inbound)")
    return _structural_chunker

def get_active_chunker():
    """Get the active chunker based on strategy configuration"""
    if CHUNKING_STRATEGY == "semantic":
        return get_semantic_chunker()
    elif CHUNKING_STRATEGY == "structural":
        return get_structural_chunker()
    else:
        logger.warning(f"Unknown chunking strategy: {CHUNKING_STRATEGY}, defaulting to semantic")
        return get_semantic_chunker()

def set_chunking_strategy(strategy: str):
    """
    Set the chunking strategy
    
    Args:
        strategy: "semantic" or "structural"
    """
    global CHUNKING_STRATEGY
    if strategy in ["semantic", "structural"]:
        CHUNKING_STRATEGY = strategy
        logger.info(f"Chunking strategy set to: {strategy}")
    else:
        logger.error(f"Invalid chunking strategy: {strategy}. Use 'semantic' or 'structural'")

def get_chunking_strategy() -> str:
    """Get the current chunking strategy"""
    return CHUNKING_STRATEGY

def safe_pdf_load_from_bytes_optimized(file_stream: BytesIO) -> List[Document]:
    """Memory-mapped PDF loading for faster I/O"""
    try:
        # Reset stream position
        file_stream.seek(0)
        
        # Memory-map the file data for faster access
        file_data = file_stream.read()
        
        # Open PDF with memory-mapped data
        doc = fitz.open(stream=file_data, filetype="pdf")
        pages = []
        
        # Extract text from all pages
        for page_num in range(len(doc)):
            page: Any = doc.load_page(page_num)
            text = page.get_text("text")
            pages.append(Document(text=text))
        
        doc.close()
        return pages
        
    except Exception as e:
        logger.error(f"Failed to load PDF from bytes: {e}")
        return []

# Backward compatibility alias
safe_pdf_load_from_bytes = safe_pdf_load_from_bytes_optimized

async def download_pdf_from_s3(fileName: str) -> Optional[BytesIO]:
    """Download PDF file from S3 and return as BytesIO stream (async)"""
    try:
        bucket_name = get_env_var("S3_BUCKET_NAME")
        if not bucket_name:
            logger.error("S3_BUCKET_NAME environment variable not set")
            return None
        
        def _sync_download():
            s3_client = get_s3_client()
            file_stream = BytesIO()
            s3_client.download_fileobj(bucket_name, fileName, file_stream)
            file_stream.seek(0)
            return file_stream
        
        thread_pool = get_thread_pool()
        loop = asyncio.get_event_loop()
        file_stream = await loop.run_in_executor(thread_pool, _sync_download)
        
        logger.info(f"Successfully downloaded {fileName} from S3 bucket {bucket_name}")
        return file_stream
        
    except Exception as e:
        logger.error(f"Failed to download {fileName} from S3: {str(e)}")
        return None

def count_tokens_fast(text: str) -> int:
    """Fast token counting using simple estimation"""
    # Simple estimation: ~4 characters per token for multilingual text
    # This is a reasonable approximation for BERT-based models
    estimated_tokens = len(text) // 4
    return max(estimated_tokens, 1)  # Ensure at least 1 token

def adaptive_chunking(text: str, max_tokens: int = 300) -> List[str]:
    """
    Adaptive chunking that uses the configured chunking strategy
    """
    if count_tokens_fast(text) <= max_tokens:
        return [text]
    
    # Get the active chunker
    chunker = get_active_chunker()
    
    # Update chunker's chunk size if different from default
    if hasattr(chunker, 'chunk_size') and chunker.chunk_size != max_tokens:
        chunker.chunk_size = max_tokens
    
    # Chunk the text using the active strategy
    chunks = chunker.chunk_text(text)
    
    # Filter out empty chunks and return
    return [chunk for chunk in chunks if chunk.strip()]

# Backward compatibility aliases
semantic_chunking = adaptive_chunking

# Backward compatibility alias
optimized_text_chunking = semantic_chunking

def optimized_page_mapping(chunks: List[str], page_texts: List[str]) -> List[tuple[int, int]]:
    """
    Optimized page range mapping using precomputed offsets
    """
    # Build cumulative character offsets for each page
    page_offsets = [0]
    for page_text in page_texts:
        page_offsets.append(page_offsets[-1] + len(page_text))
    
    full_text = "".join(page_texts)
    page_ranges = []
    
    for chunk in chunks:
        # Find chunk position in full text
        start_idx = full_text.find(chunk)
        if start_idx == -1:
            # Fallback: try with stripped text
            start_idx = full_text.find(chunk.strip())
        
        if start_idx == -1:
            page_ranges.append((1, 1))  # Fallback
            continue
        
        end_idx = start_idx + len(chunk)
        
        # Binary search for page ranges
        start_page = 1
        end_page = 1
        
        for i, offset in enumerate(page_offsets[1:], 1):
            if start_idx < offset:
                start_page = i
                break
        
        for i, offset in enumerate(page_offsets[1:], 1):
            if end_idx <= offset:
                end_page = i
                break
        
        page_ranges.append((start_page, end_page))
    
    return page_ranges

async def warm_up_embedding_model():
    """Warm up the embedding model to eliminate cold start penalty"""
    global _embedding_model_warmed
    if not _embedding_model_warmed:
        try:
            # Import here to avoid circular imports            
            def _warmup():
                model = get_local_embedding_model()
                # Process a small dummy text to warm up the model
                model.encode(["warmup text"], convert_to_tensor=False)
                return True
            
            thread_pool = get_thread_pool()
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(thread_pool, _warmup)
            
            _embedding_model_warmed = True
            logger.info("✅ Embedding model warmed up - eliminated cold start penalty")
            
        except Exception as e:
            logger.warning(f"Could not warm up embedding model: {e}")

async def process_embeddings_optimized(
    chunks_data: List[Dict[str, Any]], 
    max_batch_size: int = 128  # Increased batch size
) -> List[Dict[str, Any]]:
    """Optimized embedding processing with model warm-up and larger batches"""
    
    # Ensure model is warmed up
    await warm_up_embedding_model()
    
    # Create batches
    batches = []
    for i in range(0, len(chunks_data), max_batch_size):
        batch = chunks_data[i:i + max_batch_size]
        batches.append(batch)
    
    logger.info(f"Processing {len(chunks_data)} chunks in {len(batches)} batches (size: {max_batch_size})")
    
    all_vectors = []
    
    # Process batches concurrently with higher concurrency
    MAX_CONCURRENT_BATCHES = 6  # Increased from 3
    
    async def process_single_batch(batch_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process a single batch of embeddings"""
        try:
            texts = [item["text"] for item in batch_data]
            
            # Run embedding generation in thread pool
            def _generate_embeddings():
                return get_text_embedding_batch(texts)
            
            thread_pool = get_thread_pool()
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(thread_pool, _generate_embeddings)
            
            # Build result vectors
            vectors = []
            for item, embedding in zip(batch_data, embeddings):
                vectors.append({
                    "id": item["id"],
                    "values": embedding,
                    "metadata": item["metadata"]
                })
            
            return vectors
            
        except Exception as e:
            logger.error(f"Batch processing failed: {e}")
            return []
    
    # Process batches in chunks to limit concurrency
    for i in range(0, len(batches), MAX_CONCURRENT_BATCHES):
        batch_chunk = batches[i:i + MAX_CONCURRENT_BATCHES]
        
        tasks = [process_single_batch(batch) for batch in batch_chunk]
        batch_results = await asyncio.gather(*tasks)
        
        for result in batch_results:
            all_vectors.extend(result)
    
    return all_vectors

async def parallel_chroma_upload(vectors: List[Dict[str, Any]], collection) -> bool:
    """Parallel ChromaDB upload for better performance"""
    if not vectors:
        return True
    
    BATCH_SIZE = 200  # Larger batch size
    batches = [vectors[i:i + BATCH_SIZE] for i in range(0, len(vectors), BATCH_SIZE)]
    
    logger.info(f"Uploading {len(vectors)} vectors in {len(batches)} parallel batches")
    
    async def upload_batch(batch: List[Dict[str, Any]]) -> bool:
        """Upload a single batch to ChromaDB"""
        def _upload():
            return safe_chroma_upsert(collection, batch)
        
        thread_pool = get_thread_pool()
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(thread_pool, _upload)
    
    # Upload all batches in parallel
    tasks = [upload_batch(batch) for batch in batches]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    successful_batches = sum(1 for result in results if result is True)
    total_uploaded = successful_batches * BATCH_SIZE + (len(vectors) % BATCH_SIZE if successful_batches == len(batches) else 0)
    
    logger.info(f"Successfully uploaded {total_uploaded}/{len(vectors)} vectors")
    return successful_batches == len(batches)

async def process_pdf_pipeline_optimized(fileName: str, courseId: str, slideId: str) -> dict:
    """
    Highly optimized PDF processing pipeline
    Target: Under 5 seconds for 186-page PDF
    """
    logger.info(f"Starting OPTIMIZED PDF processing pipeline for: {fileName}")
    pipeline_start_time = time.time()
    
    # === Step 1: Download PDF from S3 and load pages ===
    step_start = time.time()
    file_stream = await download_pdf_from_s3(fileName)
    if file_stream is None:
        return {"success": False, "error": "Failed to download PDF from S3"}
    
    # Load PDF with optimized memory-mapped reading
    def _load_pdf():
        return safe_pdf_load_from_bytes_optimized(file_stream)
    
    thread_pool = get_thread_pool()
    loop = asyncio.get_event_loop()
    pages = await loop.run_in_executor(thread_pool, _load_pdf)
    
    if not pages:
        return {"success": False, "error": "Failed to load PDF from bytes"}
    
    logger.info(f"Step 1 complete: {len(pages)} pages loaded in {(time.time() - step_start)*1000:.0f}ms")

    # === Step 2: Build full document ===
    step_start = time.time()
    page_texts = [page.text for page in pages]
    full_text = "".join(page_texts)
    logger.info(f"Step 2 complete: Full text built in {(time.time() - step_start)*1000:.0f}ms")

    # === Step 3: Adaptive chunking ===
    step_start = time.time()
    logger.info(f"Using {CHUNKING_STRATEGY} chunking strategy")
    def _chunk_text():
        return adaptive_chunking(full_text, max_tokens=512)
    
    chunks = await loop.run_in_executor(thread_pool, _chunk_text)
    logger.info(f"Step 3 complete: {len(chunks)} chunks created using {CHUNKING_STRATEGY} strategy in {(time.time() - step_start)*1000:.0f}ms")

    # === Step 4: Optimized page mapping ===
    step_start = time.time()
    def _map_pages():
        return optimized_page_mapping(chunks, page_texts)
    
    page_ranges = await loop.run_in_executor(thread_pool, _map_pages)
    logger.info(f"Step 4 complete: Page mapping done in {(time.time() - step_start)*1000:.0f}ms")

    # === Step 5: Prepare chunk data ===
    step_start = time.time()
    chunk_data = []
    for chunk_idx, (chunk_text, (start_page, end_page)) in enumerate(zip(chunks, page_ranges)):
        chunk_data.append({
            "text": chunk_text,
            "metadata": {
                "courseId": courseId,
                "slideId": slideId, 
                "s3_path": fileName,
                "pageStart": start_page,
                "pageEnd": end_page,
                "rawText": chunk_text,
                "chunk_index": chunk_idx
            },
            "id": f"{courseId}#{slideId}#{chunk_idx}"
        })
    
    logger.info(f"Step 5 complete: Chunk data prepared in {(time.time() - step_start)*1000:.0f}ms")

    # === Step 6: Connect to ChromaDB ===
    step_start = time.time()
    try:
        collection = get_vector_collection()
    except Exception as e:
        return {"success": False, "error": f"Failed to connect to ChromaDB: {str(e)}"}
    logger.info(f"Step 6 complete: ChromaDB connected in {(time.time() - step_start)*1000:.0f}ms")

    # === Step 7: Optimized embedding generation ===
    step_start = time.time()
    all_vectors = await process_embeddings_optimized(chunk_data, max_batch_size=128)
    
    if len(all_vectors) != len(chunk_data):
        return {"success": False, "error": f"Embedding generation failed: {len(all_vectors)}/{len(chunk_data)} chunks processed"}
    
    logger.info(f"Step 7 complete: {len(all_vectors)} embeddings generated in {(time.time() - step_start)*1000:.0f}ms")

    # === Step 8: Parallel ChromaDB upload ===
    step_start = time.time()
    upload_success = await parallel_chroma_upload(all_vectors, collection)
    
    if not upload_success:
        return {"success": False, "error": "ChromaDB upload failed"}
    
    logger.info(f"Step 8 complete: ChromaDB upload done in {(time.time() - step_start)*1000:.0f}ms")

    # === Final results ===
    total_time_ms = int((time.time() - pipeline_start_time) * 1000)
    
    result = {
        "success": True,
        "fileName": fileName,
        "courseId": courseId,
        "slideId": slideId,
        "total_pages": len(pages),
        "total_chunks": len(chunks),
        "successful_uploads": len(all_vectors),
        "failed_batches": 0,
        "processing_time_ms": total_time_ms
    }

    logger.info(f"🎉 OPTIMIZED pipeline completed: {len(all_vectors)} vectors in {total_time_ms}ms")
    return result

def cleanup_inbound_connections():
    """Clean up connections on shutdown"""
    global _thread_pool, _s3_client, _chroma_collection, _semantic_chunker, _structural_chunker
    
    if _thread_pool:
        _thread_pool.shutdown(wait=True)
        _thread_pool = None
    
    _s3_client = None
    _chroma_collection = None
    _semantic_chunker = None
    _structural_chunker = None
    cleanup_local_embedding_model()
    cleanup_chroma_client()
    
    logger.info("Optimized inbound pipeline connections cleaned up")

# Alias for backward compatibility
process_pdf_pipeline = process_pdf_pipeline_optimized