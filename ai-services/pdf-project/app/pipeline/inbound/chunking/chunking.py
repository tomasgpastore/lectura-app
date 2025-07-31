"""
Uses MarkdownHeaderTextSplitter with fallback to RecursiveCharacterTextSplitter
Note: This code downloads the PDF from S3 and converts it to Markdown.
It then uses the MarkdownHeaderTextSplitter and RecursiveCharacterTextSplitter to split the text into chunks.
It then returns the chunks in a list of dictionaries.
"""

import time
import pymupdf4llm
from io import BytesIO
from langchain.text_splitter import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from typing import List, Dict, Any, Tuple
import fitz  # PyMuPDF
import re


# Helper Functions
def convert_pdf_to_markdown(file_stream: BytesIO) -> tuple[str, dict]:
    """
    Converts PDF from BytesIO to Markdown using PyMuPDF4LLM.
    Preserves all header levels for recursive chunking.
    Returns markdown content and metadata.
    """
    start_time = time.time()
    print(f"Starting PDF to Markdown conversion with PyMuPDF4LLM...")
    
    # Reset stream position
    file_stream.seek(0)
    
    # Create PyMuPDF Document from stream
    doc = fitz.open(stream=file_stream, filetype="pdf")
    
    # Convert PDF to markdown using the document object
    markdown_result = pymupdf4llm.to_markdown(doc, page_chunks=True, write_images=False)
    
    # Handle both list and string outputs
    page_markers = {}
    if isinstance(markdown_result, list):
        # When page_chunks=True, it returns a list of dicts with page content
        markdown_parts = []
        char_pos = 0
        for i, page_data in enumerate(markdown_result):
            if isinstance(page_data, dict):
                content = page_data.get('text', '')
            else:
                content = str(page_data)
            
            page_markers[char_pos] = i + 1
            markdown_parts.append(content)
            char_pos += len(content) + 1  # +1 for newline
        
        markdown_content = '\n'.join(markdown_parts)
    else:
        # Fallback for string output
        markdown_content = markdown_result
        lines = markdown_content.split('\n')
        current_page = 1
        char_pos = 0
        
        for i, line in enumerate(lines):
            if line.strip() == "-----" and i > 0:
                page_markers[char_pos] = current_page
                current_page += 1
            char_pos += len(line) + 1
    
    # Get only the metadata we actually use
    metadata = {
        "total_pages": doc.page_count,
        "page_markers": page_markers
    }
    
    doc.close()
    
    total_time = time.time() - start_time
    print(f"PDF to Markdown conversion completed in {total_time:.3f}s")
    print(f"Generated {len(markdown_content):,} characters")
    print(f"Document has {metadata['total_pages']} pages")
    
    # Count headers at each level
    header_counts = {}
    for level in range(1, 7):
        pattern = '\n' + '#' * level + ' '
        count = markdown_content.count(pattern)
        if count > 0:
            header_counts[f"Level {level} ('{pattern.strip()}')"] = count
    
    print(f"Headers found: {header_counts}")
    print(f"Total headers: {sum(header_counts.values())}")
    
    return markdown_content, metadata


def count_words(text: str) -> int:
    """Counts words in text."""
    return len(text.split())


def get_page_numbers(char_start: int, char_end: int, page_markers: dict, total_pages: int) -> tuple[int, int]:
    """
    Determines which pages a chunk spans based on character positions.
    """
    if not page_markers:
        return 1, 1
    
    page_start = 1
    page_end = total_pages
    
    # Find start page
    for pos, page in sorted(page_markers.items()):
        if char_start < pos:
            break
        page_start = page
    
    # Find end page
    for pos, page in sorted(page_markers.items()):
        if char_end <= pos:
            page_end = page - 1
            break
        page_end = page
    
    return page_start, max(page_start, page_end)


def extract_header_text(header_line: str) -> str:
    """Extract the header text without the # symbols"""
    match = re.match(r'^#+\s*(.+)$', header_line)
    if match:
        return match.group(1).strip()
    return header_line.strip()


def build_header_hierarchy_with_titles(chunks: List[Dict[str, Any]], markdown_text: str) -> Dict[int, Dict[str, Any]]:
    """
    Builds a map of chunk positions to header information including titles.
    Returns a dict mapping chunk_index to {level, parent_indices, parent_titles, header_text}
    """
    header_map = {}
    
    # Track the most recent header at each level with its title
    current_headers = {
        1: {"index": None, "title": None},
        2: {"index": None, "title": None},
        3: {"index": None, "title": None},
        4: {"index": None, "title": None},
        5: {"index": None, "title": None},
        6: {"index": None, "title": None}
    }
    
    for chunk in chunks:
        chunk_idx = chunk['chunk_index']
        content = chunk['text'].strip()
        
        # Check if this chunk starts with a header
        if content.startswith('#'):
            lines = content.split('\n')
            first_line = lines[0].strip()
            
            # Count header level
            level = 0
            for char in first_line:
                if char == '#':
                    level += 1
                else:
                    break
            
            if 1 <= level <= 6:
                # Extract header text
                header_text = extract_header_text(first_line)
                
                # This is a header chunk
                # Clear all lower level headers
                for lvl in range(level + 1, 7):
                    current_headers[lvl] = {"index": None, "title": None}
                
                # Set this as the current header for its level with level prefix
                level_prefix = f"H{level}^"
                current_headers[level] = {"index": chunk_idx, "title": level_prefix + header_text}
                
                # Build parent indices and titles lists
                parent_indices = []
                parent_titles = []
                for lvl in range(1, level):
                    if current_headers[lvl]["index"] is not None:
                        parent_indices.append(current_headers[lvl]["index"])
                        parent_titles.append(current_headers[lvl]["title"])
                
                header_map[chunk_idx] = {
                    'level': level,
                    'parent_indices': parent_indices,
                    'parent_titles': parent_titles,
                    'is_header': True,
                    'header_text': header_text
                }
            else:
                # Regular chunk - get current header hierarchy
                parent_indices = []
                parent_titles = []
                for lvl in range(1, 7):
                    if current_headers[lvl]["index"] is not None:
                        parent_indices.append(current_headers[lvl]["index"])
                        parent_titles.append(current_headers[lvl]["title"])
                
                header_map[chunk_idx] = {
                    'level': None,
                    'parent_indices': parent_indices,
                    'parent_titles': parent_titles,
                    'is_header': False,
                    'header_text': None
                }
        else:
            # Regular chunk - get current header hierarchy
            parent_indices = []
            parent_titles = []
            for lvl in range(1, 7):
                if current_headers[lvl]["index"] is not None:
                    parent_indices.append(current_headers[lvl]["index"])
                    parent_titles.append(current_headers[lvl]["title"])
            
            header_map[chunk_idx] = {
                'level': None,
                'parent_indices': parent_indices,
                'parent_titles': parent_titles,
                'is_header': False,
                'header_text': None
            }
    
    return header_map


def process_chunks_langchain(markdown_text: str, metadata: dict, course_id: str, slide_id: str, 
                            s3_file_name: str, max_words: int = 350) -> List[Dict[str, Any]]:
    """
    Performs chunking on markdown text using LangChain splitters.
    Uses MarkdownHeaderTextSplitter first, then RecursiveCharacterTextSplitter for oversized chunks.
    """
    print(f"\nStarting LangChain markdown chunking...")
    print(f"Max chunk size: {max_words} words")
    
    # Step 1: Markdown header-based splitting
    print("\nStep 1: Applying MarkdownHeaderTextSplitter...")
    
    # Define headers to split on
    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
        ("####", "Header 4"),
        ("#####", "Header 5"),
        ("######", "Header 6"),
    ]
    
    markdown_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=headers_to_split_on,
        strip_headers=False  # Keep headers with content
    )
    
    # Split text
    md_docs = markdown_splitter.split_text(markdown_text)
    print(f"  MarkdownHeaderTextSplitter created {len(md_docs)} initial chunks")
    
    # Convert to our format and check sizes
    processed_chunks = []
    chunks_needing_recursive_split = []
    
    # Track character position in original text
    char_position = 0
    
    for i, doc in enumerate(md_docs):
        chunk_text = doc.page_content
        word_count = count_words(chunk_text)
        
        # Find chunk position in original text
        chunk_start = markdown_text.find(chunk_text, char_position)
        if chunk_start == -1:
            chunk_start = char_position  # Fallback
        chunk_end = chunk_start + len(chunk_text)
        
        # Get page numbers
        page_start, page_end = get_page_numbers(
            chunk_start, chunk_end, 
            metadata.get('page_markers', {}), 
            metadata.get('total_pages', 1)
        )
        
        if word_count <= max_words:
            chunk_data = {
                "id": f"{course_id}:{slide_id}:{len(processed_chunks)}",
                "embedding": None,
                "text": chunk_text,
                "word_count": word_count,
                "char_count": len(chunk_text),
                "split_level": "markdown",
                "original_chunk_id": i,
                "chunk_index": len(processed_chunks),
                "page_start": page_start,
                "page_end": page_end,
                "headers_hierarchy": [],
                "headers_hierarchy_titles": [],
                "char_start_pos": chunk_start,
                "char_end_pos": chunk_end,
                "course_id": course_id,
                "slide_id": slide_id,
                "s3_file_name": s3_file_name,
                "total_pages": metadata.get('total_pages', 1),
                "timestamp": time.time(),
                # Sibling tracking - no siblings at markdown level
                "sentence_sibling_count": 1,
                "sentence_sibling_index": 0
            }
            processed_chunks.append(chunk_data)
        else:
            # Still too large, needs recursive splitting
            chunks_needing_recursive_split.append((i, chunk_text, chunk_start))
        
        char_position = chunk_end
    
    print(f"  Chunks within size limit: {len(processed_chunks)}")
    print(f"  Chunks needing recursive splitting: {len(chunks_needing_recursive_split)}")
    
    # Step 2: Recursive character splitting for oversized chunks
    if chunks_needing_recursive_split:
        print("\nStep 2: Applying RecursiveCharacterTextSplitter to oversized chunks...")
        
        # Calculate approximate character limit from word limit
        # Assuming average word length of 5 characters + 1 space
        char_limit = max_words * 6
        
        recursive_splitter = RecursiveCharacterTextSplitter(
            chunk_size=char_limit,
            chunk_overlap=0,
            separators=[
                ". ",      # Period followed by space (sentence boundary)
                "! ",      # Exclamation followed by space
                "? ",      # Question mark followed by space
                "; ",      # Semicolon followed by space
                ", ",      # Comma followed by space
                " ",       # Space
                ""         # Character
            ],
            length_function=len,
            keep_separator="end"  # Keep separator at end of chunk (with previous sentence)
        )
        
        for orig_id, text, parent_start in chunks_needing_recursive_split:
            # Split the oversized chunk
            sub_docs = recursive_splitter.split_text(text)
            
            # Calculate total siblings for this group
            total_siblings = len(sub_docs)
            
            # Process each sub-chunk
            local_pos = 0
            for sibling_idx, sub_text in enumerate(sub_docs):
                sub_word_count = count_words(sub_text)
                
                # Calculate position in original document
                chunk_start = parent_start + text.find(sub_text, local_pos)
                chunk_end = chunk_start + len(sub_text)
                local_pos = chunk_end - parent_start
                
                # Get page numbers
                page_start, page_end = get_page_numbers(
                    chunk_start, chunk_end,
                    metadata.get('page_markers', {}),
                    metadata.get('total_pages', 1)
                )
                
                chunk_data = {
                    "id": f"{course_id}:{slide_id}:{len(processed_chunks)}",
                    "embedding": None,
                    "text": sub_text,
                    "word_count": sub_word_count,
                    "char_count": len(sub_text),
                    "split_level": "recursive",
                    "original_chunk_id": orig_id,
                    "chunk_index": len(processed_chunks),
                    "page_start": page_start,
                    "page_end": page_end,
                    "headers_hierarchy": [],
                    "headers_hierarchy_titles": [],
                    "char_start_pos": chunk_start,
                    "char_end_pos": chunk_end,
                    "course_id": course_id,
                    "slide_id": slide_id,
                    "s3_file_name": s3_file_name,
                    "total_pages": metadata.get('total_pages', 1),
                    "timestamp": time.time(),
                    # Sibling tracking
                    "sentence_sibling_count": total_siblings,
                    "sentence_sibling_index": sibling_idx
                }
                processed_chunks.append(chunk_data)
    
    # CRITICAL: Sort chunks by document position to maintain reading order
    processed_chunks.sort(key=lambda x: x["char_start_pos"])
    
    # Reassign IDs and chunk_index to maintain sequential order
    for i, chunk in enumerate(processed_chunks):
        chunk["id"] = f"{course_id}:{slide_id}:{i}"
        chunk["chunk_index"] = i
    
    # Validate sibling relationships are contiguous
    print("\nValidating sibling relationships...")
    validate_sibling_contiguity(processed_chunks)
    
    # Build header hierarchy with titles
    print("\nBuilding header hierarchy with titles...")
    header_map = build_header_hierarchy_with_titles(processed_chunks, markdown_text)
    
    # Update chunks with header hierarchy indices and titles
    for chunk in processed_chunks:
        chunk_idx = chunk['chunk_index']
        if chunk_idx in header_map:
            chunk['headers_hierarchy'] = header_map[chunk_idx]['parent_indices']
            chunk['headers_hierarchy_titles'] = header_map[chunk_idx]['parent_titles']
            if header_map[chunk_idx]['is_header']:
                chunk['is_header'] = True
                if header_map[chunk_idx]['level']:
                    chunk['header_level'] = header_map[chunk_idx]['level']
                if header_map[chunk_idx]['header_text']:
                    chunk['header_text'] = header_map[chunk_idx]['header_text']
    
    print(f"\nLangChain chunking completed")
    print(f"Total chunks created: {len(processed_chunks)}")
    
    # Count by split level
    split_counts = {}
    for chunk in processed_chunks:
        level = chunk["split_level"]
        split_counts[level] = split_counts.get(level, 0) + 1
    
    print(f"Chunks by split level: {split_counts}")
    
    return processed_chunks


def validate_sibling_contiguity(chunks: List[Dict[str, Any]]) -> None:
    """
    Validates that sibling chunks are contiguous in the chunk list.
    This is critical for sibling arithmetic to work correctly.
    """
    # Group chunks by original_chunk_id
    from collections import defaultdict
    chunk_groups = defaultdict(list)
    
    for i, chunk in enumerate(chunks):
        orig_id = chunk['original_chunk_id']
        chunk_groups[orig_id].append((i, chunk))
    
    # Check each group
    issues_found = False
    for orig_id, chunk_list in chunk_groups.items():
        if len(chunk_list) > 1:
            # Sort by index to check contiguity
            chunk_list.sort(key=lambda x: x[0])
            indices = [x[0] for x in chunk_list]
            
            # Check if indices are consecutive
            for i in range(1, len(indices)):
                if indices[i] != indices[i-1] + 1:
                    print(f"WARNING: Non-contiguous siblings found for original chunk {orig_id}")
                    print(f"  Indices: {indices}")
                    issues_found = True
                    break
            
            # Also verify sibling indices are correct
            for idx, (chunk_idx, chunk) in enumerate(chunk_list):
                expected_sibling_idx = idx
                actual_sibling_idx = chunk['sentence_sibling_index']
                if actual_sibling_idx != expected_sibling_idx:
                    print(f"WARNING: Incorrect sibling index for chunk {chunk_idx}")
                    print(f"  Expected sentence_sibling_index: {expected_sibling_idx}, got: {actual_sibling_idx}")
                    issues_found = True
    
    if not issues_found:
        print("  ✓ Sibling contiguity validation passed")
    else:
        print("  ✗ Sibling contiguity validation found issues")


# Main Function
def chunk_pdf(course_id: str, slide_id: str, s3_file_name: str, 
              file_stream: BytesIO, max_words: int = 350) -> List[Dict[str, Any]]:
    """
    Main function that takes PDF BytesIO input and returns list of chunks.
    
    Args:
        course_id: The course ID for the chunks
        slide_id: The slide ID for the chunks
        s3_file_name: The S3 file name/path
        file_stream: BytesIO containing the PDF data
        max_words: Maximum words per chunk (default 350)
    
    Returns:
        List of chunks with specified format
    """
    start_time = time.time()
    
    # Ensure file_stream is at the beginning
    file_stream.seek(0)
    
    # Step 1: Convert PDF to Markdown
    print("Converting PDF to Markdown...")
    markdown_content, metadata = convert_pdf_to_markdown(file_stream)
    
    # Step 2: Process chunks with LangChain splitters
    print("Processing chunks with LangChain...")
    chunks = process_chunks_langchain(
        markdown_content, 
        metadata, 
        course_id, 
        slide_id, 
        s3_file_name, 
        max_words
    )
    
    total_time = time.time() - start_time
    print(f"\nTotal processing time: {total_time:.3f}s")
    print(f"Processed {len(chunks)} chunks")
    
    return chunks