import re
from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class StructuralChunker:
    """
    Structural chunking implementation that splits text based on document structure
    such as headings, paragraphs, lists, and other formatting elements.
    """
    
    def __init__(self, chunk_size: int = 512, overlap_size: int = 50):
        """
        Initialize the structural chunker
        
        Args:
            chunk_size: Maximum chunk size in tokens
            overlap_size: Number of tokens to overlap between chunks
        """
        self.chunk_size = chunk_size
        self.overlap_size = overlap_size
        
        # Compile regex patterns for different structural elements
        self._compile_patterns()
        
    def _compile_patterns(self):
        """Compile regex patterns for structural elements"""
        
        # Heading patterns (various levels)
        self.heading_patterns = [
            re.compile(r'^#{1,6}\s+.+$', re.MULTILINE),  # Markdown headings
            re.compile(r'^[A-Z][A-Z\s]{10,}$', re.MULTILINE),  # ALL CAPS headings
            re.compile(r'^\d+\.\s+[A-Z].*$', re.MULTILINE),  # Numbered sections
            re.compile(r'^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*:?\s*$', re.MULTILINE),  # Title Case headings
            re.compile(r'^[IVX]+\.\s+[A-Z].*$', re.MULTILINE),  # Roman numeral sections
        ]
        
        # List patterns
        self.list_patterns = [
            re.compile(r'^\s*[-•*]\s+.*$', re.MULTILINE),  # Bullet lists
            re.compile(r'^\s*\d+\.\s+.*$', re.MULTILINE),  # Numbered lists
            re.compile(r'^\s*[a-zA-Z]\.\s+.*$', re.MULTILINE),  # Lettered lists
            re.compile(r'^\s*[ivx]+\.\s+.*$', re.MULTILINE),  # Roman numeral lists
        ]
        
        # Paragraph boundaries
        self.paragraph_pattern = re.compile(r'\n\s*\n', re.MULTILINE)
        
        # Sentence boundaries
        self.sentence_pattern = re.compile(r'[.!?]+\s+')
        
        # Table patterns
        self.table_patterns = [
            re.compile(r'\|.*\|', re.MULTILINE),  # Pipe-separated tables
            re.compile(r'^.+\t.+$', re.MULTILINE),  # Tab-separated data
        ]
        
        # Code/technical patterns
        self.code_patterns = [
            re.compile(r'```.*?```', re.DOTALL),  # Code blocks
            re.compile(r'`[^`]+`'),  # Inline code
        ]
        
        # Citation/reference patterns
        self.citation_patterns = [
            re.compile(r'\[\d+\]'),  # Numbered citations
            re.compile(r'\([^)]*\d{4}[^)]*\)'),  # Year citations
        ]
        
    def _count_tokens_estimate(self, text: str) -> int:
        """Estimate token count (roughly 4 characters per token)"""
        return len(text) // 4
    
    def _identify_structural_elements(self, text: str) -> List[Dict]:
        """Identify structural elements in the text"""
        elements = []
        lines = text.split('\n')
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped:
                continue
                
            element_type = 'paragraph'  # default
            confidence = 0.5
            
            # Check for headings
            for pattern in self.heading_patterns:
                if pattern.match(line_stripped):
                    element_type = 'heading'
                    confidence = 0.9
                    break
            
            # Check for lists
            if element_type == 'paragraph':
                for pattern in self.list_patterns:
                    if pattern.match(line_stripped):
                        element_type = 'list_item'
                        confidence = 0.8
                        break
            
            # Check for tables
            if element_type == 'paragraph':
                for pattern in self.table_patterns:
                    if pattern.match(line_stripped):
                        element_type = 'table'
                        confidence = 0.8
                        break
            
            # Check for code
            if element_type == 'paragraph':
                for pattern in self.code_patterns:
                    if pattern.search(line_stripped):
                        element_type = 'code'
                        confidence = 0.7
                        break
            
            elements.append({
                'line_number': i,
                'text': line,
                'type': element_type,
                'confidence': confidence
            })
        
        return elements
    
    def _group_by_structure(self, elements: List[Dict]) -> List[Dict]:
        """Group elements by structural hierarchy"""
        groups = []
        current_group = []
        current_heading = None
        
        for element in elements:
            if element['type'] == 'heading':
                # Save current group if it exists
                if current_group:
                    groups.append({
                        'heading': current_heading,
                        'elements': current_group,
                        'text': '\n'.join([e['text'] for e in current_group])
                    })
                
                # Start new group
                current_heading = element['text']
                current_group = [element]
                
            else:
                current_group.append(element)
        
        # Add the last group
        if current_group:
            groups.append({
                'heading': current_heading,
                'elements': current_group,
                'text': '\n'.join([e['text'] for e in current_group])
            })
        
        return groups
    
    def _split_by_paragraphs(self, text: str) -> List[str]:
        """Split text by paragraph boundaries"""
        paragraphs = self.paragraph_pattern.split(text)
        return [p.strip() for p in paragraphs if p.strip()]
    
    def _split_by_sentences(self, text: str) -> List[str]:
        """Split text by sentence boundaries"""
        sentences = self.sentence_pattern.split(text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _create_overlapping_chunks(self, segments: List[str]) -> List[str]:
        """Create chunks with overlap from segments"""
        chunks = []
        current_chunk = []
        current_tokens = 0
        
        for i, segment in enumerate(segments):
            segment_tokens = self._count_tokens_estimate(segment)
            
            # If adding this segment would exceed chunk size
            if current_tokens + segment_tokens > self.chunk_size and current_chunk:
                # Save current chunk
                chunks.append(' '.join(current_chunk))
                
                # Start new chunk with overlap
                overlap_text = ' '.join(current_chunk[-self.overlap_size:]) if len(current_chunk) > self.overlap_size else ''
                if overlap_text:
                    current_chunk = [overlap_text, segment]
                    current_tokens = self._count_tokens_estimate(overlap_text) + segment_tokens
                else:
                    current_chunk = [segment]
                    current_tokens = segment_tokens
            else:
                current_chunk.append(segment)
                current_tokens += segment_tokens
        
        # Add the last chunk
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    def _split_large_chunk(self, text: str) -> List[str]:
        """Split a chunk that's too large"""
        # First try paragraphs
        paragraphs = self._split_by_paragraphs(text)
        if len(paragraphs) > 1:
            return self._create_overlapping_chunks(paragraphs)
        
        # Then try sentences
        sentences = self._split_by_sentences(text)
        if len(sentences) > 1:
            return self._create_overlapping_chunks(sentences)
        
        # Finally, split by words
        words = text.split()
        word_chunks = []
        current_chunk = []
        current_tokens = 0
        
        for word in words:
            word_tokens = self._count_tokens_estimate(word)
            if current_tokens + word_tokens > self.chunk_size and current_chunk:
                word_chunks.append(' '.join(current_chunk))
                current_chunk = [word]
                current_tokens = word_tokens
            else:
                current_chunk.append(word)
                current_tokens += word_tokens
        
        if current_chunk:
            word_chunks.append(' '.join(current_chunk))
        
        return word_chunks
    
    def chunk_text(self, text: str) -> List[str]:
        """
        Main method to chunk text structurally
        
        Args:
            text: Input text to chunk
            
        Returns:
            List of structurally coherent chunks
        """
        if not text.strip():
            return []
        
        # If text is already small enough, return as is
        if self._count_tokens_estimate(text) <= self.chunk_size:
            return [text]
        
        try:
            # Step 1: Identify structural elements
            elements = self._identify_structural_elements(text)
            
            # Step 2: Group by structure
            groups = self._group_by_structure(elements)
            
            # Step 3: Process each group
            chunks = []
            for group in groups:
                group_text = group['text']
                group_tokens = self._count_tokens_estimate(group_text)
                
                if group_tokens <= self.chunk_size:
                    # Group fits in one chunk
                    chunks.append(group_text)
                else:
                    # Split group further
                    sub_chunks = self._split_large_chunk(group_text)
                    chunks.extend(sub_chunks)
            
            # Step 4: Post-process chunks
            final_chunks = []
            for chunk in chunks:
                chunk = chunk.strip()
                if chunk and self._count_tokens_estimate(chunk) > 0:
                    final_chunks.append(chunk)
            
            # If no structural chunks were created, fall back to paragraph splitting
            if not final_chunks:
                paragraphs = self._split_by_paragraphs(text)
                final_chunks = self._create_overlapping_chunks(paragraphs)
            
            # Final fallback to sentence splitting
            if not final_chunks:
                sentences = self._split_by_sentences(text)
                final_chunks = self._create_overlapping_chunks(sentences)
            
            logger.info(f"Structural chunking: {len(elements)} elements -> {len(final_chunks)} chunks")
            return final_chunks if final_chunks else [text]
            
        except Exception as e:
            logger.error(f"Error in structural chunking: {e}")
            # Fallback to simple paragraph chunking
            return self._fallback_chunking(text)
    
    def _fallback_chunking(self, text: str) -> List[str]:
        """Fallback chunking method if structural chunking fails"""
        paragraphs = self._split_by_paragraphs(text)
        if not paragraphs:
            return [text]
        
        return self._create_overlapping_chunks(paragraphs)
    
    def get_chunk_info(self, text: str) -> Dict:
        """Get information about how the text would be chunked"""
        elements = self._identify_structural_elements(text)
        groups = self._group_by_structure(elements)
        
        element_types = {}
        for element in elements:
            element_type = element['type']
            element_types[element_type] = element_types.get(element_type, 0) + 1
        
        return {
            'total_elements': len(elements),
            'element_types': element_types,
            'groups': len(groups),
            'estimated_chunks': len(self.chunk_text(text))
        }