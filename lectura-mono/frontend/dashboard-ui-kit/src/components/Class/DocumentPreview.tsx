import React, { useState, useEffect, useRef } from 'react';
import { FileText, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import { Document } from '../../types';
import { slideApi } from '../../lib/api/api';
import { useParams, useLocation } from 'react-router-dom';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker for react-pdf v10 (matches bundled pdfjs-dist@5.3.31)
pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.3.31/build/pdf.worker.min.mjs';

// PDF Cache to store blob URLs in memory
const pdfCache = new Map<string, string>();

interface DocumentPreviewProps {
  document: Document;
  onClose: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  onClose,
}) => {
  const { id: courseId } = useParams<{ id: string }>();
  const location = useLocation();
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cacheKey = `${courseId}_${document.id}`;

  // Check if this is a PDF file
  const isPDF = document.type.toLowerCase().includes('pdf') || 
                document.name.toLowerCase().endsWith('.pdf');

  // Dynamic scaling based on container width (horizontal scaling only)
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        // Simple proportional scaling - 400px container = 1.0 scale (100%)
        const dynamicScale = width / 400; // 400px = base width for 100% scale
        setScale(Math.max(dynamicScale, 0.3)); // Minimum scale to prevent too small
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Track current page based on scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !numPages) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      
      // Find which page is most visible
      let mostVisiblePage = 1;
      let maxVisibility = 0;

      pageRefs.current.forEach((pageRef, index) => {
        if (!pageRef) return;
        
        const pageTop = pageRef.offsetTop - container.offsetTop;
        const pageBottom = pageTop + pageRef.offsetHeight;
        
        // Calculate how much of the page is visible
        const visibleTop = Math.max(scrollTop, pageTop);
        const visibleBottom = Math.min(scrollTop + containerHeight, pageBottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const visibility = visibleHeight / pageRef.offsetHeight;
        
        if (visibility > maxVisibility) {
          maxVisibility = visibility;
          mostVisiblePage = index + 1;
        }
      });

      if (mostVisiblePage !== currentPage) {
        setCurrentPage(mostVisiblePage);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [numPages, currentPage]);

  // Clean up cache when navigating away from the page
  useEffect(() => {
    const currentPath = location.pathname;
    
    return () => {
      // Check if we're navigating away from the current course page
      if (location.pathname !== currentPath) {
        // Clear cached PDF
        const cachedUrl = pdfCache.get(cacheKey);
        if (cachedUrl) {
          URL.revokeObjectURL(cachedUrl);
          pdfCache.delete(cacheKey);
        }
      }
    };
  }, [location.pathname, cacheKey]);

  useEffect(() => {
    const loadPdfUrl = async () => {
      if (!isPDF || !courseId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Check if PDF is already cached
        const cachedUrl = pdfCache.get(cacheKey);
        if (cachedUrl) {
          setPdfUrl(cachedUrl);
          setLoading(false);
          return;
        }

        // Fetch new PDF and cache it
        const presignedUrl = await slideApi.getPresignedUrl(courseId, document.id);
        
        // Fetch the PDF as blob and create object URL
        const response = await fetch(presignedUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch PDF');
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Cache the blob URL
        pdfCache.set(cacheKey, blobUrl);
        setPdfUrl(blobUrl);
        
      } catch (err) {
        console.error('Failed to load PDF URL:', err);
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    loadPdfUrl();
  }, [document.id, courseId, isPDF, cacheKey]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
    // Initialize page refs array
    pageRefs.current = new Array(numPages).fill(null);
  };

  const onDocumentLoadError = (error: any) => {
    console.error('Failed to load PDF:', error);
    setError('Failed to load PDF document');
  };

  // Navigate to specific page with instant scrolling
  const goToPage = (pageNumber: number) => {
    const targetPage = Math.max(1, Math.min(pageNumber, numPages));
    const pageRef = pageRefs.current[targetPage - 1];
    
    if (pageRef && containerRef.current) {
      pageRef.scrollIntoView({ 
        behavior: 'auto',
        block: 'start' 
      });
      setCurrentPage(targetPage);
    }
  };

  const goToPrevPage = () => {
    goToPage(currentPage - 1);
  };

  const goToNextPage = () => {
    goToPage(currentPage + 1);
  };

  // Render all pages for smooth scrolling
  const renderAllPages = () => {
    if (!numPages) return null;
    
    const pages = [];
    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      pages.push(
        <div 
          key={pageNumber}
          ref={(el) => (pageRefs.current[pageNumber - 1] = el)}
          className="mb-4 last:mb-0"
        >
          <Page 
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-sm border border-gray-200 dark:border-neutral-700"
          />
        </div>
      );
    }
    return pages;
  };

  return (
    <div className="bg-white dark:bg-neutral-800 dark:border-neutral-700 rounded-xl border flex flex-col h-full max-h-full overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {document.name}
        </h3>
        <div className="flex items-center space-x-2">
          {isPDF && !loading && !error && numPages > 0 && (
            <>
              {/* Page Navigation */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage <= 1}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400 min-w-20 text-center">
                  {currentPage} / {numPages}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage >= numPages}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
          
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-50 dark:bg-neutral-900 min-h-0"
        tabIndex={0}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">
                {pdfCache.has(cacheKey) ? 'Loading cached document...' : 'Loading document...'}
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <p className="text-red-500 dark:text-red-400 mb-2">
              {error}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              File: {document.name}
            </p>
          </div>
        ) : isPDF && pdfUrl ? (
          <div className="p-4">
            <div className="flex flex-col items-center">
              <PDFDocument
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">Loading PDF...</p>
                  </div>
                }
                error={
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <p className="text-red-500 dark:text-red-400">
                      Failed to load PDF
                    </p>
                  </div>
                }
              >
                {renderAllPages()}
              </PDFDocument>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              {isPDF ? 'PDF preview not available' : 'Document preview not available for this file type'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              File: {document.name} ({document.type})
            </p>
          </div>
        )}
      </div>
    </div>
  );
}; 