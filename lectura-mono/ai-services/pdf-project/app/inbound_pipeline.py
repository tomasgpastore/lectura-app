from llama_index.readers.file import PyMuPDFReader
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core.node_parser import SemanticSplitterNodeParser
from llama_index.core.schema import Document
from pinecone.grpc.pinecone import PineconeGRPC as Pinecone
from nltk.tokenize import sent_tokenize
from app.config import get_env_var
import bisect
import tiktoken
import logging
import time
import fitz
import boto3
import asyncio
from typing import Optional, List, Any
from io import BytesIO

# Configure logging for microservice
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# nltk.download('punkt')

# Environment variables are loaded by app.config

# === ERROR HANDLING UTILITIES ===
def safe_get_embedding(embed_model, text: str, max_retries: int = 3) -> Optional[List[float]]:
    """Get embedding with retry logic and error handling"""
    for attempt in range(max_retries):
        try:
            return embed_model.get_text_embedding(text)
        except Exception as e:
            logger.warning(f"Embedding attempt {attempt + 1}/{max_retries} failed: {str(e)[:100]}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
            else:
                logger.error(f"Failed to get embedding after {max_retries} attempts for text: {text[:50]}...")
                return None

def safe_get_embeddings_batch(embed_model, texts: List[str], max_retries: int = 5) -> Optional[List[List[float]]]:
    """Get batch embeddings with robust retry logic and exponential backoff"""
    for attempt in range(max_retries):
        try:
            return embed_model.get_text_embedding_batch(texts)
        except Exception as e:
            wait_time = min(60, 2 ** attempt)  # Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 60s)
            logger.warning(f"Batch embedding attempt {attempt + 1}/{max_retries} failed: {str(e)[:100]}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                logger.error(f"Failed to get batch embeddings after {max_retries} attempts for {len(texts)} texts")
                return None

def safe_pinecone_upsert(index, vectors: List[dict], max_retries: int = 3) -> bool:
    """Upload to Pinecone with retry logic and error handling"""
    for attempt in range(max_retries):
        try:
            index.upsert(vectors=vectors)
            return True
        except Exception as e:
            logger.warning(f"Pinecone upload attempt {attempt + 1}/{max_retries} failed: {str(e)[:100]}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
    
    # If we get here, all retries failed
    logger.error(f"Failed to upload batch of {len(vectors)} vectors after {max_retries} attempts")
    return False

def safe_pdf_load(pdf_path: str) -> Optional[List]:
    """Load PDF with error handling"""
    try:
        pages = PyMuPDFReader().load_data(pdf_path)
        if not pages:
            logger.error(f"PDF loaded but contains no pages: {pdf_path}")
            return None
        return pages
    except Exception as e:
        logger.error(f"Failed to load PDF {pdf_path}: {str(e)}")
        return None

def safe_pdf_load_from_bytes(file_stream: BytesIO) -> List[Document]:
    try:
        doc = fitz.open(stream=file_stream, filetype="pdf")
        pages = []
        for page_num in range(len(doc)):
            page: Any = doc.load_page(page_num)
            text = page.get_text("text")
            pages.append(Document(text=text))
        doc.close()
        return pages
    except Exception as e:
        logger.error(f"Failed to load PDF from bytes: {e}")
        return []

async def download_pdf_from_s3(fileName: str) -> Optional[BytesIO]:
    """Download PDF file from S3 and return as BytesIO stream (async)"""
    try:
        bucket_name = get_env_var("S3_BUCKET_NAME")
        if not bucket_name:
            logger.error("S3_BUCKET_NAME environment variable not set")
            return None
        
        # Define the sync download function inline and run in thread pool
        def _sync_download():
            s3_client = boto3.client('s3')
            file_stream = BytesIO()
            s3_client.download_fileobj(bucket_name, fileName, file_stream)
            file_stream.seek(0)
            return file_stream
        
        # Run the sync download in a thread pool for async performance
        file_stream = await asyncio.to_thread(_sync_download)
        
        logger.info(f"Successfully downloaded {fileName} from S3 bucket {bucket_name}")
        return file_stream
        
    except Exception as e:
        logger.error(f"Failed to download {fileName} from S3: {str(e)}")
        return None

async def process_pdf_pipeline(fileName: str, courseId: str, slideId: str) -> dict:
    """
    Main PDF processing pipeline function
    
    Args:
        fileName: Name of PDF file in S3 bucket
        courseId: Course identifier
        slideId: Slide identifier
    
    Returns:
        dict: Processing results with success status and metadata
    """
    logger.info(f"Starting PDF processing pipeline for: {fileName}")
    pipeline_start_time = time.time()
    
    # === Step 1: Download PDF from S3 and load pages ===
    file_stream = await download_pdf_from_s3(fileName)
    if file_stream is None:
        logger.error("Failed to download PDF from S3. Pipeline terminated.")
        return {"success": False, "error": "Failed to download PDF from S3"}
    
    pages = safe_pdf_load_from_bytes(file_stream)
    if not pages:
        logger.error("Failed to load PDF from bytes. Pipeline terminated.")
        return {"success": False, "error": "Failed to load PDF from bytes"}
    
    logger.info(f"Loaded PDF with {len(pages)} pages")

    # === Step 2: Build full document with page-index mapping ===
    page_texts = []
    page_offsets = []  # start index of each page in the final full_text

    for page in pages:
        page_offsets.append(len("".join(page_texts)))
        page_texts.append(page.text)

    full_text = "".join(page_texts)
    full_doc = Document(text=full_text)

    # === Step 3: Setup embedding and splitter ===
    try:
        embed_model = OpenAIEmbedding(
            model="text-embedding-3-small",
            dimensions=1536,
            )
        logger.info("Successfully initialized OpenAI embedding model")
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI embedding model: {str(e)}")
        return {"success": False, "error": f"Failed to initialize OpenAI embedding model: {str(e)}"}

    try:
        splitter = SemanticSplitterNodeParser(
            buffer_size=1,
            breakpoint_percentile_threshold=95,
            embed_model=embed_model,
        )
        logger.info("Successfully initialized semantic splitter")
    except Exception as e:
        logger.error(f"Failed to initialize semantic splitter: {str(e)}")
        return {"success": False, "error": f"Failed to initialize semantic splitter: {str(e)}"}

    # === Step 4: Chunk full document semantically ===
    try:
        nodes = splitter.get_nodes_from_documents([full_doc])
        logger.info(f"Successfully created {len(nodes)} semantic chunks")
    except Exception as e:
        logger.error(f"Failed to create semantic chunks: {str(e)}")
        return {"success": False, "error": f"Failed to create semantic chunks: {str(e)}"}

    # === Config ===
    MAX_TOKENS = 512  # Set based on your model

    # === Setup tokenizer ===
    tokenizer = tiktoken.encoding_for_model("text-embedding-3-small")

    def count_tokens(text):
        return len(tokenizer.encode(text))

    def split_large_node_by_tokens(node, max_tokens=MAX_TOKENS, min_tokens=55):
        content = node.get_content()
        if count_tokens(content) <= max_tokens:
            return [node]

        sentences = sent_tokenize(content)
        chunks = []
        current_pos = 0  # Track position in original text
        current_sentences = []

        for sentence in sentences:
            # Find sentence in original content to preserve exact formatting
            sentence_start = content.find(sentence, current_pos)
            if sentence_start == -1:
                sentence_start = current_pos
            
            # Calculate what the chunk would be if we add this sentence
            if current_sentences:
                # Get the exact text from start of first sentence to end of this sentence
                first_sentence_start = content.find(current_sentences[0], 0)
                sentence_end = sentence_start + len(sentence)
                tentative_text = content[first_sentence_start:sentence_end]
            else:
                tentative_text = sentence
            
            if count_tokens(tentative_text) <= max_tokens:
                current_sentences.append(sentence)
                current_pos = sentence_start + len(sentence)
            else:
                # Save current chunk with original formatting
                if current_sentences:
                    first_sentence_start = content.find(current_sentences[0], 0)
                    last_sentence = current_sentences[-1]
                    last_sentence_start = content.find(last_sentence, first_sentence_start)
                    last_sentence_end = last_sentence_start + len(last_sentence)
                    chunk_text = content[first_sentence_start:last_sentence_end]
                    
                    new_node = node.model_copy()
                    new_node.text = chunk_text
                    chunks.append(new_node)
                
                # Start new chunk
                current_sentences = [sentence]
                current_pos = sentence_start + len(sentence)

        # Handle the final chunk
        if current_sentences:
            first_sentence_start = content.find(current_sentences[0], 0)
            last_sentence = current_sentences[-1]
            last_sentence_start = content.find(last_sentence, first_sentence_start)
            last_sentence_end = last_sentence_start + len(last_sentence)
            chunk_text = content[first_sentence_start:last_sentence_end]
            
            new_node = node.model_copy()
            new_node.text = chunk_text
            
            if chunks and count_tokens(chunk_text) < min_tokens:
                # Merge into previous chunk by extending the previous chunk's text
                prev_chunk_text = chunks[-1].text
                # Find where previous chunk ends and extend to include this chunk
                prev_end = content.find(prev_chunk_text) + len(prev_chunk_text)
                extended_text = content[content.find(chunks[-1].text):last_sentence_end]
                chunks[-1].text = extended_text
            else:
                chunks.append(new_node)

        return chunks

    # === Step 4.5: Replace char-based splitting ===
    try:
        final_nodes = []
        for node in nodes:
            final_nodes.extend(split_large_node_by_tokens(node, max_tokens=MAX_TOKENS))
        logger.info(f"Successfully processed token-based splitting, created {len(final_nodes)} final chunks")
    except Exception as e:
        logger.error(f"Failed during token-based splitting: {str(e)}")
        return {"success": False, "error": f"Failed during token-based splitting: {str(e)}"}

    # === Step 5: Map each chunk to page range ===
    def find_page_range(node_text, full_text, page_offsets):
        """
        Simple and robust page range detection with correct page numbering.
        Returns (start_page, end_page) with 1-indexed page numbers.
        """
        # Try exact match first, then stripped
        start_idx = full_text.find(node_text)
        if start_idx == -1:
            start_idx = full_text.find(node_text.strip())
        
        if start_idx == -1:
            # Return page 1 as fallback
            return 1, 1
        
        end_idx = start_idx + len(node_text.strip() if full_text.find(node_text) == -1 else node_text)
        
        # Fix bisect_right issue: subtract 1 and convert to 1-indexed pages
        start_page = max(0, bisect.bisect_right(page_offsets, start_idx) - 1) + 1
        end_page = max(0, bisect.bisect_right(page_offsets, end_idx) - 1) + 1
        
        return start_page, end_page

    # ===================================
    logger.info(f"Processing {len(final_nodes)} chunks for display")
    for i, node in enumerate(final_nodes):
        chunk_text = node.get_content()
        start_page, end_page = find_page_range(chunk_text, full_text, page_offsets)

        logger.info(f"Chunk {i+1} - Page Range: {start_page} to {end_page}")
        logger.debug(f"Chunk {i+1} content: {chunk_text[:100]}...") 
        
    # === Step 6: Batch Processing and Upload to Pinecone ===
    try:
        pc = Pinecone(api_key=get_env_var("PINECONE_API_KEY"))
        
        # Use same index name as outbound pipeline
        index_name = get_env_var('PINECONE_INDEX_NAME')
        
        if not index_name:
            raise ValueError("PINECONE_INDEX_NAME environment variable not set")

        index = pc.Index(index_name)
        logger.info(f"Successfully connected to Pinecone index: {index_name}")
    except Exception as e:
        logger.error(f"Failed to connect to Pinecone: {str(e)}")
        return {"success": False, "error": f"Failed to connect to Pinecone: {str(e)}"}

    logger.info(f"Starting batch processing for {len(final_nodes)} chunks")

    # Prepare all chunk data for batch processing
    chunk_data = []
    for chunk_idx, node in enumerate(final_nodes):
        chunk_text = node.get_content()
        start_page, end_page = find_page_range(chunk_text, full_text, page_offsets)
        
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

    # Generate embeddings in batches with token and text count limits
    MAX_BATCH_TEXTS = 2048    # OpenAI limit: max 2048 texts per batch
    MAX_BATCH_TOKENS = 8191   # OpenAI limit: max 8191 tokens per batch (for text-embedding-3-small)
    
    logger.info(f"Generating embeddings for {len(chunk_data)} chunks with smart batching (max {MAX_BATCH_TEXTS} texts, {MAX_BATCH_TOKENS} tokens per batch)")

    all_vectors = []
    failed_chunks = 0
    
    # Smart batching: respect both text count and token limits
    batches = []
    current_batch = []
    current_batch_tokens = 0
    
    for chunk in chunk_data:
        chunk_tokens = count_tokens(chunk["text"])
        
        # Check if adding this chunk would exceed limits
        if (len(current_batch) >= MAX_BATCH_TEXTS or 
            current_batch_tokens + chunk_tokens > MAX_BATCH_TOKENS):
            
            # Save current batch and start new one
            if current_batch:
                batches.append(current_batch)
                current_batch = []
                current_batch_tokens = 0
        
        # Add chunk to current batch
        current_batch.append(chunk)
        current_batch_tokens += chunk_tokens
    
    # Don't forget the last batch
    if current_batch:
        batches.append(current_batch)
    
    logger.info(f"Created {len(batches)} optimized batches based on token limits")
    
    # Process each batch with robust retry logic
    for batch_idx, batch_chunks in enumerate(batches):
        batch_texts = [chunk["text"] for chunk in batch_chunks]
        batch_tokens = sum(count_tokens(text) for text in batch_texts)
        
        logger.info(f"Processing batch {batch_idx + 1}/{len(batches)} ({len(batch_chunks)} chunks, {batch_tokens} tokens)")
        
        # Robust retry with exponential backoff (no fallback to individual calls)
        batch_embeddings = safe_get_embeddings_batch(embed_model, batch_texts, max_retries=5)
        
        if batch_embeddings is not None and len(batch_embeddings) == len(batch_chunks):
            # Process successful batch
            for chunk, embedding in zip(batch_chunks, batch_embeddings):
                all_vectors.append({
                    "id": chunk["id"],
                    "values": embedding,
                    "metadata": chunk["metadata"]
                })
            logger.info(f"✅ Successfully processed batch {batch_idx + 1} with {len(batch_chunks)} embeddings")
        else:
            # Batch completely failed after retries - log error but continue
            failed_chunks += len(batch_chunks)
            logger.error(f"❌ Batch {batch_idx + 1} failed completely after retries - {len(batch_chunks)} chunks lost")

    if failed_chunks > 0:
        logger.warning(f"Failed to generate embeddings for {failed_chunks}/{len(chunk_data)} chunks")
        return {"success": False, "error": f"Failed to generate embeddings for {failed_chunks} chunks"}
    else:
        logger.info(f"Successfully generated embeddings for all {len(chunk_data)} chunks")

    # Batch Pinecone upload with error handling
    PINECONE_BATCH_SIZE = 100  # Pinecone recommended batch size
    logger.info(f"Uploading {len(all_vectors)} vectors to Pinecone in batches of {PINECONE_BATCH_SIZE}")

    if len(all_vectors) == 0:
        logger.error("No vectors to upload - all embeddings failed")
        return {"success": False, "error": "No vectors to upload - all embeddings failed"}

    successful_uploads = 0
    failed_batches = 0

    for i in range(0, len(all_vectors), PINECONE_BATCH_SIZE):
        batch = all_vectors[i:i + PINECONE_BATCH_SIZE]
        
        logger.info(f"Uploading batch {i//PINECONE_BATCH_SIZE + 1}/{(len(all_vectors)-1)//PINECONE_BATCH_SIZE + 1} ({len(batch)} vectors)")
        
        if safe_pinecone_upsert(index, batch):
            successful_uploads += len(batch)
        else:
            failed_batches += 1
            logger.error(f"Failed to upload batch {i//PINECONE_BATCH_SIZE + 1}")

    # Calculate total pipeline processing time
    pipeline_end_time = time.time()
    total_time_ms = int((pipeline_end_time - pipeline_start_time) * 1000)

    # Return success result
    result = {
        "success": True,
        "fileName": fileName,
        "courseId": courseId,
        "slideId": slideId,
        "total_pages": len(pages),
        "total_chunks": len(final_nodes),
        "successful_uploads": successful_uploads,
        "failed_batches": failed_batches,
        "processing_time_ms": total_time_ms
    }

    if failed_batches > 0:
        logger.warning(f"Upload completed with {failed_batches} failed batches. Successfully uploaded {successful_uploads}/{len(all_vectors)} vectors. Total processing time: {total_time_ms}ms")
        result["warning"] = f"Upload completed with {failed_batches} failed batches"
    else:
        logger.info(f"Successfully processed and uploaded all {len(all_vectors)} vectors to Pinecone. Total processing time: {total_time_ms}ms")

    return result

# Example usage (for testing)
if __name__ == "__main__":
    # For local testing with file path instead of S3
    result = process_pdf_pipeline("test-file.pdf", "course_123", "slide_456")
    print(f"Pipeline result: {result}")