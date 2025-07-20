import numpy as np
import re
from typing import List, Optional
from sklearn.metrics.pairwise import cosine_similarity
from embedding.local_embedding import get_text_embedding_batch
import logging

logger = logging.getLogger(__name__)

class SemanticChunker:
    """
    Custom semantic chunking implementation that uses the existing multilingual-minilm-local model
    Works similarly to llama index's SemanticSplitterNodeParser
    """
    
    def __init__(self, 
                 buffer_size: int = 3,
                 breakpoint_percentile_threshold: int = 90,
                 chunk_size: int = 300):
        """
        Initialize the semantic chunker
        
        Args:
            buffer_size: Number of sentences to group together for comparison
            breakpoint_percentile_threshold: Threshold percentile for semantic breaks
            chunk_size: Maximum chunk size in tokens
        """
        self.buffer_size = buffer_size
        self.breakpoint_percentile_threshold = breakpoint_percentile_threshold
        self.chunk_size = chunk_size
        
        # Compile regex patterns for sentence splitting
        self.sentence_pattern = re.compile(r'[.!?]+\s+')
        self.word_pattern = re.compile(r'\s+')
        
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences using regex patterns"""
        sentences = self.sentence_pattern.split(text)
        # Clean up sentences and remove empty ones
        sentences = [s.strip() for s in sentences if s.strip()]
        return sentences
    
    def _count_tokens_estimate(self, text: str) -> int:
        """Estimate token count (roughly 4 characters per token)"""
        return len(text) // 4
    
    def _create_sentence_groups(self, sentences: List[str]) -> List[str]:
        """Group sentences according to buffer_size"""
        groups = []
        for i in range(0, len(sentences), self.buffer_size):
            group = ' '.join(sentences[i:i + self.buffer_size])
            if group.strip():
                groups.append(group)
        return groups
    
    def _calculate_similarities(self, sentence_groups: List[str]) -> List[float]:
        """Calculate cosine similarities between adjacent sentence groups"""
        if len(sentence_groups) < 2:
            return []
        
        # Get embeddings for all sentence groups
        embeddings = get_text_embedding_batch(sentence_groups)
        embeddings = np.array(embeddings)
        
        # Calculate cosine similarities between adjacent groups
        similarities = []
        for i in range(len(embeddings) - 1):
            sim = cosine_similarity([embeddings[i]], [embeddings[i + 1]])[0][0]
            similarities.append(sim)
        
        return similarities
    
    def _find_breakpoints(self, similarities: List[float]) -> List[int]:
        """Find breakpoints based on similarity threshold"""
        if not similarities:
            return []
        
        # Calculate the threshold based on percentile
        threshold = np.percentile(similarities, self.breakpoint_percentile_threshold)
        
        # Find indices where similarity is below threshold
        breakpoints = []
        for i, sim in enumerate(similarities):
            if sim < threshold:
                breakpoints.append(i + 1)  # +1 because we want to split after this group
        
        return breakpoints
    
    def _create_chunks_from_breakpoints(self, sentence_groups: List[str], breakpoints: List[int]) -> List[str]:
        """Create chunks based on identified breakpoints"""
        chunks = []
        start_idx = 0
        
        # Add breakpoints for the end of the text
        breakpoints = breakpoints + [len(sentence_groups)]
        
        for breakpoint in breakpoints:
            if breakpoint > start_idx:
                chunk_text = ' '.join(sentence_groups[start_idx:breakpoint])
                if chunk_text.strip():
                    chunks.append(chunk_text.strip())
                start_idx = breakpoint
        
        return chunks
    
    def _split_large_chunks(self, chunks: List[str]) -> List[str]:
        """Split chunks that are too large based on token count"""
        final_chunks = []
        
        for chunk in chunks:
            if self._count_tokens_estimate(chunk) <= self.chunk_size:
                final_chunks.append(chunk)
            else:
                # Split large chunks by sentences
                sentences = self._split_into_sentences(chunk)
                current_chunk = []
                current_length = 0
                
                for sentence in sentences:
                    sentence_length = self._count_tokens_estimate(sentence)
                    
                    if current_length + sentence_length <= self.chunk_size:
                        current_chunk.append(sentence)
                        current_length += sentence_length
                    else:
                        # Save current chunk if it has content
                        if current_chunk:
                            final_chunks.append(' '.join(current_chunk))
                        
                        # Start new chunk
                        if sentence_length <= self.chunk_size:
                            current_chunk = [sentence]
                            current_length = sentence_length
                        else:
                            # Split very long sentences by words
                            words = self.word_pattern.split(sentence)
                            word_chunk = []
                            word_length = 0
                            
                            for word in words:
                                word_len = self._count_tokens_estimate(word)
                                if word_length + word_len <= self.chunk_size:
                                    word_chunk.append(word)
                                    word_length += word_len
                                else:
                                    if word_chunk:
                                        final_chunks.append(' '.join(word_chunk))
                                    word_chunk = [word]
                                    word_length = word_len
                            
                            if word_chunk:
                                current_chunk = word_chunk
                                current_length = word_length
                            else:
                                current_chunk = []
                                current_length = 0
                
                # Add remaining chunk
                if current_chunk:
                    final_chunks.append(' '.join(current_chunk))
        
        return final_chunks
    
    def chunk_text(self, text: str) -> List[str]:
        """
        Main method to chunk text semantically
        
        Args:
            text: Input text to chunk
            
        Returns:
            List of semantically coherent chunks
        """
        if not text.strip():
            return []
        
        # If text is already small enough, return as is
        if self._count_tokens_estimate(text) <= self.chunk_size:
            return [text]
        
        try:
            # Step 1: Split into sentences
            sentences = self._split_into_sentences(text)
            
            if len(sentences) <= 1:
                return [text]
            
            # Step 2: Create sentence groups
            sentence_groups = self._create_sentence_groups(sentences)
            
            if len(sentence_groups) <= 1:
                return [text]
            
            # Step 3: Calculate similarities between adjacent groups
            similarities = self._calculate_similarities(sentence_groups)
            
            # Step 4: Find breakpoints
            breakpoints = self._find_breakpoints(similarities)
            
            # Step 5: Create chunks from breakpoints
            chunks = self._create_chunks_from_breakpoints(sentence_groups, breakpoints)
            
            # Step 6: Split chunks that are too large
            final_chunks = self._split_large_chunks(chunks)
            
            # Filter out empty chunks
            final_chunks = [chunk for chunk in final_chunks if chunk.strip()]
            
            if not final_chunks:
                return [text]
            
            logger.info(f"Semantic chunking: {len(sentences)} sentences -> {len(final_chunks)} chunks")
            return final_chunks
            
        except Exception as e:
            logger.error(f"Error in semantic chunking: {e}")
            # Fallback to simple sentence-based chunking
            return self._fallback_chunking(text)
    
    def _fallback_chunking(self, text: str) -> List[str]:
        """Fallback chunking method if semantic chunking fails"""
        sentences = self._split_into_sentences(text)
        chunks = []
        current_chunk = []
        current_length = 0
        
        for sentence in sentences:
            sentence_length = self._count_tokens_estimate(sentence)
            
            if current_length + sentence_length <= self.chunk_size:
                current_chunk.append(sentence)
                current_length += sentence_length
            else:
                if current_chunk:
                    chunks.append(' '.join(current_chunk))
                current_chunk = [sentence]
                current_length = sentence_length
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks if chunks else [text]