# ChromaDB Manager Usage Guide

The `chroma_db_manager.py` file provides utilities to view, manage, and clean the ChromaDB vector database.

## Features

- **View collection info**: See total vector count and metadata structure
- **List vectors**: Display vectors with their content and metadata
- **Search vectors**: Semantic search within the collection
- **List courses**: Show all unique course IDs
- **Delete all vectors**: Clean the entire database
- **Delete by course**: Remove vectors for a specific course

## Usage

### 1. View Collection Information

```bash
python chroma_db_manager.py info
```

This shows:
- Collection name
- Total number of vectors
- Sample metadata structure

### 2. View Vectors

```bash
# Show first 5 vectors
python chroma_db_manager.py vectors

# Show first 10 vectors
python chroma_db_manager.py vectors --limit 10
```

This displays:
- Vector IDs
- Document content (first 200 characters)
- Full metadata for each vector

### 3. List Unique Courses

```bash
python chroma_db_manager.py courses
```

Shows all unique course IDs in the database.

### 4. Search Vectors

```bash
python chroma_db_manager.py search --query "machine learning"
```

Performs semantic search and shows:
- Most similar vectors
- Similarity distances
- Document content and metadata

### 5. Delete All Vectors

```bash
# WARNING: This deletes everything!
python chroma_db_manager.py delete-all --confirm
```

**⚠️ DANGER**: This permanently deletes ALL vectors in the collection!

### 6. Delete Vectors by Course

```bash
# Delete all vectors for a specific course
python chroma_db_manager.py delete-course --course "COURSE_ID_123" --confirm
```

## Safety Features

- All destructive operations require the `--confirm` flag
- The script shows warnings before deletion
- Provides clear feedback on what was deleted

## Example Output

### Collection Info
```
================================================================================
CHROMADB COLLECTION INFORMATION
================================================================================
Collection Name: pdf_documents
Total Vectors: 1,234
Timestamp: 2024-01-15T10:30:00

Sample Metadata Keys: ['courseId', 'slideId', 's3_path', 'pageStart', 'pageEnd', 'chunk_index']
```

### Vectors Display
```
================================================================================
VECTORS (showing 5 of 1,234)
================================================================================

--- Vector 1 ---
ID: COURSE_123#SLIDE_456#0
Document: This is the introduction to machine learning concepts. Machine learning is a subset of artificial intelligence...
Metadata:
  courseId: COURSE_123
  slideId: SLIDE_456
  s3_path: documents/ml_intro.pdf
  pageStart: 1
  pageEnd: 1
  chunk_index: 0
```

## Integration with Chunking Strategies

The manager works with both semantic and structural chunking strategies. The metadata will show which chunks came from which pages and documents, making it easy to:

- Track chunking effectiveness
- Debug retrieval issues
- Analyze document coverage
- Monitor database growth

## Environment Requirements

Make sure you have:
- ChromaDB running and accessible
- Environment variables set (if using remote ChromaDB)
- All dependencies installed (chromadb, sentence-transformers, etc.)

## Troubleshooting

### Connection Issues
If you get connection errors:
1. Check if ChromaDB is running
2. Verify environment variables
3. Ensure the collection exists

### No Vectors Found
If the collection is empty:
1. Run the PDF processing pipeline first
2. Check the inbound pipeline logs
3. Verify S3 access and PDF files exist

### Search Not Working
If semantic search fails:
1. Check if the embedding model is loaded
2. Verify the local embedding model path
3. Make sure dependencies are installed