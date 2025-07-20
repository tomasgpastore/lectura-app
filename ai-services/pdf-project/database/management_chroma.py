#!/usr/bin/env python3
"""
ChromaDB Manager - Utility to view and manage vectors in ChromaDB
"""

import sys
import os
import logging
from typing import List, Dict, Any, Optional, Sequence, Literal
from datetime import datetime

# Add the project directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.chroma_client import get_chroma_collection, cleanup_chroma_client
from app.config import get_env_var

# Type alias for ChromaDB include parameter - using Any to avoid complex type issues
ChromaInclude = List[str]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ChromaDBManager:
    """Utility class to manage ChromaDB operations"""
    
    def __init__(self):
        self.collection = None
        self._initialize_connection()
    
    def _initialize_connection(self):
        """Initialize connection to ChromaDB"""
        try:
            self.collection = get_chroma_collection()
            logger.info("✅ Connected to ChromaDB")
        except Exception as e:
            logger.error(f"❌ Failed to connect to ChromaDB: {e}")
            raise
    
    def _ensure_collection(self):
        """Ensure collection is initialized"""
        if self.collection is None:
            raise RuntimeError("ChromaDB collection not initialized")
        return self.collection
    
    def get_collection_info(self) -> Dict[str, Any]:
        """Get basic information about the collection"""
        try:
            collection = self._ensure_collection()
            count = collection.count()
            
            # Get collection metadata
            metadata = {}
            try:
                # Try to get some sample data to understand the structure
                if count > 0:
                    sample_results = collection.get(limit=1)
                    if sample_results and 'metadatas' in sample_results and sample_results['metadatas']:
                        sample_metadata = sample_results['metadatas'][0]
                        metadata = {
                            'sample_metadata_keys': list(sample_metadata.keys()) if sample_metadata else [],
                            'sample_metadata': sample_metadata
                        }
            except Exception as e:
                logger.warning(f"Could not get sample metadata: {e}")
            
            return {
                'total_vectors': count,
                'collection_name': collection.name,
                'timestamp': datetime.now().isoformat(),
                'metadata_info': metadata
            }
        except Exception as e:
            logger.error(f"Error getting collection info: {e}")
            return {'error': str(e)}
    
    def get_vectors(self, limit: int = 10, offset: int = 0, include_embeddings: bool = False) -> Dict[str, Any]:
        """
        Get vectors from the collection
        
        Args:
            limit: Maximum number of vectors to return
            offset: Number of vectors to skip
            include_embeddings: Whether to include the actual embedding vectors
        """
        try:
            collection = self._ensure_collection()
            # ChromaDB doesn't support offset directly, so we'll get more and slice
            actual_limit = limit + offset
            
            include_list: ChromaInclude = ['documents', 'metadatas', 'ids']
            if include_embeddings:
                include_list.append('embeddings')
            
            results = collection.get(
                limit=actual_limit,
                include=include_list  # type: ignore
            )
            
            # Apply offset manually
            if offset > 0:
                for key in results:
                    if isinstance(results[key], list) and len(results[key]) > offset:
                        results[key] = results[key][offset:]
                    elif isinstance(results[key], list):
                        results[key] = []
            
            # Limit results
            for key in results:
                if isinstance(results[key], list) and len(results[key]) > limit:
                    results[key] = results[key][:limit]
            
            return {
                'vectors': results,
                'count': len(results.get('ids', [])),
                'total_in_collection': collection.count()
            }
        except Exception as e:
            logger.error(f"Error getting vectors: {e}")
            return {'error': str(e)}
    
    def search_vectors(self, query: str, limit: int = 5) -> Dict[str, Any]:
        """Search for vectors similar to a query"""
        try:
            from embedding.local_embedding import get_text_embedding
            collection = self._ensure_collection()
            
            # Get embedding for the query
            query_embedding = get_text_embedding(query)
            
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=limit,
                include=['documents', 'metadatas', 'distances']  # type: ignore
            )
            
            return {
                'query': query,
                'results': results,
                'count': len(results.get('ids', [[]])[0]) if results.get('ids') else 0
            }
        except Exception as e:
            logger.error(f"Error searching vectors: {e}")
            return {'error': str(e)}
    
    def get_vectors_by_course(self, course_id: str, limit: int = 10) -> Dict[str, Any]:
        """Get vectors for a specific course"""
        try:
            collection = self._ensure_collection()
            results = collection.get(
                where={"courseId": {"$eq": course_id}},
                limit=limit,
                include=['documents', 'metadatas']  # type: ignore
            )
            
            return {
                'course_id': course_id,
                'vectors': results,
                'count': len(results.get('ids', []))
            }
        except Exception as e:
            logger.error(f"Error getting vectors by course: {e}")
            return {'error': str(e)}
    
    def get_unique_courses(self) -> List[str]:
        """Get list of unique course IDs in the collection"""
        try:
            collection = self._ensure_collection()
            # Get all metadata
            all_results = collection.get(include=['metadatas'])  # type: ignore
            
            courses = set()
            metadatas = all_results.get('metadatas', [])
            if metadatas:
                for metadata in metadatas:
                    if metadata and 'courseId' in metadata:
                        courses.add(metadata['courseId'])
            
            return sorted(list(courses))
        except Exception as e:
            logger.error(f"Error getting unique courses: {e}")
            return []
    
    def delete_all_vectors(self, confirm: bool = False) -> Dict[str, Any]:
        """
        Delete all vectors from the collection
        
        Args:
            confirm: Must be True to actually delete
        """
        if not confirm:
            return {
                'error': 'Deletion not confirmed. Set confirm=True to actually delete all vectors.'
            }
        
        try:
            collection = self._ensure_collection()
            # Get all IDs first - ChromaDB get() returns ids by default
            all_results = collection.get()
            all_ids = all_results.get('ids', [])
            
            if not all_ids:
                return {'message': 'No vectors to delete', 'deleted_count': 0}
            
            # Delete all vectors
            collection.delete(ids=all_ids)
            
            # Verify deletion
            new_count = collection.count()
            deleted_count = len(all_ids)
            
            logger.info(f"✅ Deleted {deleted_count} vectors from ChromaDB")
            
            return {
                'message': f'Successfully deleted {deleted_count} vectors',
                'deleted_count': deleted_count,
                'remaining_count': new_count
            }
        except Exception as e:
            logger.error(f"Error deleting vectors: {e}")
            return {'error': str(e)}
    
    def delete_vectors_by_course(self, course_id: str, confirm: bool = False) -> Dict[str, Any]:
        """Delete all vectors for a specific course"""
        if not confirm:
            return {
                'error': f'Deletion not confirmed. Set confirm=True to actually delete vectors for course {course_id}.'
            }
        
        try:
            collection = self._ensure_collection()
            # Get vectors for this course
            course_results = collection.get(
                where={"courseId": {"$eq": course_id}}
            )
            
            course_ids = course_results.get('ids', [])
            
            if not course_ids:
                return {'message': f'No vectors found for course {course_id}', 'deleted_count': 0}
            
            # Delete the vectors
            collection.delete(ids=course_ids)
            
            deleted_count = len(course_ids)
            logger.info(f"✅ Deleted {deleted_count} vectors for course {course_id}")
            
            return {
                'message': f'Successfully deleted {deleted_count} vectors for course {course_id}',
                'deleted_count': deleted_count,
                'course_id': course_id
            }
        except Exception as e:
            logger.error(f"Error deleting vectors for course {course_id}: {e}")
            return {'error': str(e)}
    
    def cleanup(self):
        """Clean up connections"""
        try:
            cleanup_chroma_client()
            logger.info("✅ Cleaned up ChromaDB connections")
        except Exception as e:
            logger.error(f"Error cleaning up: {e}")

def print_collection_info(manager: ChromaDBManager):
    """Print collection information in a formatted way"""
    info = manager.get_collection_info()
    
    print("=" * 80)
    print("CHROMADB COLLECTION INFORMATION")
    print("=" * 80)
    
    if 'error' in info:
        print(f"❌ Error: {info['error']}")
        return
    
    print(f"Collection Name: {info['collection_name']}")
    print(f"Total Vectors: {info['total_vectors']:,}")
    print(f"Timestamp: {info['timestamp']}")
    
    if 'metadata_info' in info and info['metadata_info']:
        print(f"\nSample Metadata Keys: {info['metadata_info'].get('sample_metadata_keys', [])}")
        sample_meta = info['metadata_info'].get('sample_metadata', {})
        if sample_meta:
            print("Sample Metadata:")
            for key, value in sample_meta.items():
                print(f"  {key}: {value}")

def print_vectors(manager: ChromaDBManager, limit: int = 5):
    """Print vectors in a formatted way"""
    vectors = manager.get_vectors(limit=limit)
    
    print("\n" + "=" * 80)
    print(f"VECTORS (showing {limit} of {vectors.get('total_in_collection', 0)})")
    print("=" * 80)
    
    if 'error' in vectors:
        print(f"❌ Error: {vectors['error']}")
        return
    
    vector_data = vectors.get('vectors', {})
    ids = vector_data.get('ids', [])
    documents = vector_data.get('documents', [])
    metadatas = vector_data.get('metadatas', [])
    
    if not ids:
        print("No vectors found.")
        return
    
    for i, (id_, doc, meta) in enumerate(zip(ids, documents, metadatas)):
        print(f"\n--- Vector {i+1} ---")
        print(f"ID: {id_}")
        print(f"Document: {doc[:200]}{'...' if len(doc) > 200 else ''}")
        if meta:
            print("Metadata:")
            for key, value in meta.items():
                print(f"  {key}: {value}")

def print_courses(manager: ChromaDBManager):
    """Print unique courses"""
    courses = manager.get_unique_courses()
    
    print("\n" + "=" * 80)
    print("UNIQUE COURSES")
    print("=" * 80)
    
    if not courses:
        print("No courses found.")
        return
    
    for i, course in enumerate(courses, 1):
        print(f"{i}. {course}")

def main():
    """Main function for command-line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description='ChromaDB Manager')
    parser.add_argument('action', choices=['info', 'vectors', 'courses', 'search', 'delete-all', 'delete-course'],
                       help='Action to perform')
    parser.add_argument('--limit', type=int, default=5, help='Number of vectors to show')
    parser.add_argument('--query', type=str, help='Search query')
    parser.add_argument('--course', type=str, help='Course ID')
    parser.add_argument('--confirm', action='store_true', help='Confirm deletion')
    
    args = parser.parse_args()
    
    manager = ChromaDBManager()
    
    try:
        if args.action == 'info':
            print_collection_info(manager)
        
        elif args.action == 'vectors':
            print_collection_info(manager)
            print_vectors(manager, limit=args.limit)
        
        elif args.action == 'courses':
            print_courses(manager)
        
        elif args.action == 'search':
            if not args.query:
                print("❌ Please provide a search query with --query")
                return
            
            result = manager.search_vectors(args.query, limit=args.limit)
            if 'error' in result:
                print(f"❌ Error: {result['error']}")
            else:
                print(f"\n🔍 Search Results for: '{args.query}'")
                print("=" * 80)
                results = result.get('results', {})
                ids = results.get('ids', [[]])[0]
                documents = results.get('documents', [[]])[0]
                distances = results.get('distances', [[]])[0]
                metadatas = results.get('metadatas', [[]])[0]
                
                for i, (id_, doc, dist, meta) in enumerate(zip(ids, documents, distances, metadatas)):
                    print(f"\n--- Result {i+1} (Distance: {dist:.4f}) ---")
                    print(f"ID: {id_}")
                    print(f"Document: {doc[:200]}{'...' if len(doc) > 200 else ''}")
                    if meta:
                        print("Metadata:")
                        for key, value in meta.items():
                            print(f"  {key}: {value}")
        
        elif args.action == 'delete-all':
            if not args.confirm:
                print("⚠️  WARNING: This will delete ALL vectors in the collection!")
                print("To confirm, run with --confirm flag")
                return
            
            result = manager.delete_all_vectors(confirm=True)
            if 'error' in result:
                print(f"❌ Error: {result['error']}")
            else:
                print(f"✅ {result['message']}")
        
        elif args.action == 'delete-course':
            if not args.course:
                print("❌ Please provide a course ID with --course")
                return
            
            if not args.confirm:
                print(f"⚠️  WARNING: This will delete all vectors for course '{args.course}'!")
                print("To confirm, run with --confirm flag")
                return
            
            result = manager.delete_vectors_by_course(args.course, confirm=True)
            if 'error' in result:
                print(f"❌ Error: {result['error']}")
            else:
                print(f"✅ {result['message']}")
    
    finally:
        manager.cleanup()

if __name__ == "__main__":
    main()