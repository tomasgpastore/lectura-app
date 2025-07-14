import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, X, ChevronLeft, ChevronRight, Bookmark } from 'lucide-react';
import { debounce } from '../../utils/debounce';
import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { bookmarkPlugin } from '@react-pdf-viewer/bookmark';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import { highlightPlugin, Trigger, RenderHighlightTargetProps } from '@react-pdf-viewer/highlight';
import { scrollModePlugin, ScrollMode } from '@react-pdf-viewer/scroll-mode';
import { Document } from '../../types';
import { slideApi } from '../../lib/api/api';
import { useParams, useLocation } from 'react-router-dom';

// Import only the core styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';
import '@react-pdf-viewer/bookmark/lib/styles/index.css';
import '@react-pdf-viewer/zoom/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

// PDF Cache with LRU eviction to prevent memory leaks
class LRUCache {
  private maxSize: number;
  private cache: Map<string, string>;
  private accessOrder: string[];

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key: string): string | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
    }
    return value;
  }

  set(key: string, value: string): void {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.set(key, value);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
    } else {
      // Add new
      if (this.cache.size >= this.maxSize) {
        // Evict least recently used
        const lru = this.accessOrder.shift();
        if (lru) {
          const oldUrl = this.cache.get(lru);
          if (oldUrl) {
            URL.revokeObjectURL(oldUrl); // Clean up blob URL
          }
          this.cache.delete(lru);
        }
      }
      this.cache.set(key, value);
      this.accessOrder.push(key);
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    // Clean up all blob URLs
    this.cache.forEach(url => URL.revokeObjectURL(url));
    this.cache.clear();
    this.accessOrder = [];
  }
}

const pdfCache = new LRUCache(20); // Maximum 20 cached PDFs

interface DocumentPreviewProps {
  document: Document;
  onClose: () => void;
  onAddToChat?: (text: string) => void;
  onPageChange?: (currentPage: number) => void;
  initialPage?: number;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  onClose,
  onAddToChat,
  onPageChange,
  initialPage,
}) => {
  console.log(`DocumentPreview render - initialPage: ${initialPage}, document: ${document.name}`);
  const { id: courseId } = useParams<{ id: string }>();
  const location = useLocation();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [showBookmarks, setShowBookmarks] = useState<boolean>(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const cacheKey = `${courseId}_${document.id}`;

  // Check if this is a PDF file
  const isPDF = document.type.toLowerCase().includes('pdf') || 
                document.name.toLowerCase().endsWith('.pdf');

  // Create plugins with optimizations
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;
  
  const bookmarkPluginInstance = bookmarkPlugin();
  const { Bookmarks } = bookmarkPluginInstance;
  
  const zoomPluginInstance = zoomPlugin();
  const { zoomTo } = zoomPluginInstance;
  
  const scrollModePluginInstance = scrollModePlugin();
  const { switchScrollMode } = scrollModePluginInstance;



  // Enhanced highlight plugin for better text selection
  const renderHighlightTarget = useCallback((props: RenderHighlightTargetProps) => {
    if (!onAddToChat) {
      return <div style={{ display: 'none' }} />; // Return empty div instead of null
    }
    
    return (
      <div
        className="pdf-text-selection-popup"
        style={{
          position: 'absolute',
          left: `${props.selectionRegion.left}%`,
          top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
          transform: 'translate(-50%, 8px)',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '0.375rem',
          padding: '0.5rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
        }}
      >
        <button
          onClick={() => {
            onAddToChat(props.selectedText);
            props.cancel(); // Clear selection
          }}
          className="flex items-center space-x-2 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
        >
          <span>Ask in Chat</span>
        </button>
      </div>
    );
  }, [onAddToChat]);

  const highlightPluginInstance = highlightPlugin({
    trigger: Trigger.TextSelection,
    renderHighlightTarget,
  });

  // Optimized dynamic scaling using actual PDF page dimensions
  useEffect(() => {
    if (!containerRef.current || !zoomTo || !pdfDoc) return;

    const updateScale = async () => {
      if (containerRef.current && pdfDoc) {
        try {
          // Get the first page to determine page dimensions
          const page = await pdfDoc.getPage(1);
          const viewport = page.getViewport({ scale: 1 });
          const pageWidth = viewport.width;
          
          // Get container width (subtract padding from CSS)
          const containerWidth = containerRef.current.clientWidth - 32; // Account for 1rem padding on each side
          
          // Calculate zoom to fit container width exactly
          const targetZoom = containerWidth / pageWidth;
          zoomTo(Math.max(0.3, targetZoom));
          
        } catch (error) {
          console.error('Error getting page dimensions:', error);
          // Fallback
          const containerWidth = containerRef.current.clientWidth - 32;
          const targetZoom = containerWidth / 595;
          zoomTo(Math.max(0.3, targetZoom));
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateScale, 50);
    });

    resizeObserver.observe(containerRef.current);

    // Initial scale
    updateScale();

    return () => {
      resizeObserver.disconnect();
    };
  }, [zoomTo, pdfDoc]);

  // Clean up cache and save page when navigating away
  useEffect(() => {
    const currentPath = location.pathname;
    
    return () => {
      // Save current page before cleanup
      if (currentPage > 1) {
        saveCurrentPage(currentPage);
      }
      
      if (location.pathname !== currentPath) {
        const cachedUrl = pdfCache.get(cacheKey);
        if (cachedUrl) {
          URL.revokeObjectURL(cachedUrl);
          pdfCache.delete(cacheKey);
        }
      }
    };
  }, [location.pathname, cacheKey, currentPage]);

  // Optimized PDF loading with better caching
  useEffect(() => {
    const loadPdfUrl = async () => {
      if (!isPDF || !courseId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Check cache first
        const cachedUrl = pdfCache.get(cacheKey);
        if (cachedUrl) {
          setPdfUrl(cachedUrl);
          setLoading(false);
          return;
        }

        // Fetch PDF and create blob URL for better performance
        const presignedUrl = await slideApi.getPresignedUrl(courseId, document.id);
        const response = await fetch(presignedUrl);
        
        if (!response.ok) {
          throw new Error('Failed to fetch PDF');
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Cache the URL for better performance
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

  // Save current page to localStorage (debounced to prevent excessive writes)
  const saveCurrentPage = useCallback(
    debounce((page: number) => {
      if (courseId && document.id) {
        localStorage.setItem(`pdf-page-${courseId}-${document.id}`, page.toString());
      }
    }, 1000),
    [courseId, document.id]
  );

  // Load saved page from localStorage
  const getSavedPage = useCallback((): number => {
    if (courseId && document.id) {
      const saved = localStorage.getItem(`pdf-page-${courseId}-${document.id}`);
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  }, [courseId, document.id]);

  // Optimized page navigation with immediate jumping and no animation delays
  const goToPrevPage = useCallback(() => {
    if (currentPage > 1 && jumpToPage) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage); // Update state immediately
      jumpToPage(newPage - 1); // jumpToPage is 0-indexed - immediate jump
      saveCurrentPage(newPage); // Save immediately
    }
  }, [currentPage, jumpToPage, saveCurrentPage]);

  const goToNextPage = useCallback(() => {
    if (currentPage < numPages && jumpToPage) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage); // Update state immediately
      jumpToPage(newPage - 1); // jumpToPage is 0-indexed - immediate jump
      saveCurrentPage(newPage); // Save immediately
    }
  }, [currentPage, numPages, jumpToPage, saveCurrentPage]);

  const toggleBookmarks = useCallback(() => {
    setShowBookmarks(!showBookmarks);
  }, [showBookmarks]);

  const handleClose = useCallback(() => {
    // Save current page before closing
    saveCurrentPage(currentPage);
    onClose();
  }, [currentPage, saveCurrentPage, onClose]);

  // Keyboard navigation disabled in scroll mode to prevent jumping
  // useEffect(() => {
  //   const handleKeyDown = (e: KeyboardEvent) => {
  //     if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
  //       e.preventDefault();
  //       goToPrevPage();
  //     } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
  //       e.preventDefault();
  //       goToNextPage();
  //     }
  //   };

  //   // Only add event listener when PDF is loaded and viewer is active
  //   if (pdfUrl && !loading && !error) {
  //     window.addEventListener('keydown', handleKeyDown);
  //     return () => {
  //       window.removeEventListener('keydown', handleKeyDown);
  //     };
  //   }
  // }, [pdfUrl, loading, error, goToPrevPage, goToNextPage]);



  // Handle clicks outside to close bookmarks
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showBookmarks && !(e.target as Element).closest('.bookmark-popup') && !(e.target as Element).closest('[title="Bookmark"]')) {
        setShowBookmarks(false);
      }
    };
    
    window.document.addEventListener('click', handleClickOutside);
    return () => {
      window.document.removeEventListener('click', handleClickOutside);
    };
  }, [showBookmarks]);

  // Track previous initialPage to ensure navigation always works
  const prevInitialPageRef = useRef<number | undefined>(undefined);

  // Handle page changes from initialPage prop (for source navigation)
  useEffect(() => {
    if (initialPage && jumpToPage && numPages > 0 && initialPage !== prevInitialPageRef.current) {
      const targetPage = Math.min(initialPage, numPages);
      if (targetPage > 0) {
        console.log(`Jumping to page ${targetPage} from source navigation (previous: ${prevInitialPageRef.current}, current: ${currentPage})`);
        setCurrentPage(targetPage);
        requestAnimationFrame(() => {
          jumpToPage(targetPage - 1); // jumpToPage is 0-indexed
        });
        saveCurrentPage(targetPage);
        prevInitialPageRef.current = initialPage;
      }
    }
  }, [initialPage, jumpToPage, numPages]);

  return (
    <div className="bg-white dark:bg-neutral-800 dark:border-neutral-700 rounded-xl border flex flex-col h-full max-h-full overflow-hidden">
      {/* Header with custom controls */}
      <div className="p-4 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {document.name}
        </h3>
        <div className="flex items-center space-x-2">
          {/* Optimized PDF Controls */}
          {isPDF && !loading && !error && numPages > 0 && (
            <>
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage <= 1}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous page (← or ↑)"
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
                  title="Next page (→ or ↓)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              <div className="relative">
                <button
                  onClick={toggleBookmarks}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Bookmark"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
                
                {/* Bookmarks Dropdown */}
                {showBookmarks && (
                  <div className="bookmark-popup absolute right-0 top-full mt-2 w-64 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-lg shadow-lg z-50 max-h-80 overflow-auto">
                    <div className="p-3 border-b border-gray-200 dark:border-neutral-700">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Document Outline</h4>
                    </div>
                    <div className="p-2">
                      <Bookmarks />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Optimized PDF Viewer Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden bg-gray-50 dark:bg-neutral-900 min-h-0 relative"
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
          <div id={`document-preview-${document.id}`} className="h-full">
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
              <Viewer
                fileUrl={pdfUrl}
                plugins={[
                  bookmarkPluginInstance, 
                  zoomPluginInstance,
                  highlightPluginInstance,
                  scrollModePluginInstance
                ]}
                defaultScale={SpecialZoomLevel.PageFit}
                onDocumentLoad={(e) => {
                  setNumPages(e.doc.numPages);
                  setPdfDoc(e.doc); // Store the PDF document for scaling calculations
                  
                  // Set vertical scroll mode for smooth scrolling
                  setTimeout(() => {
                    switchScrollMode(ScrollMode.Vertical);
                  }, 200);
                  
                  // Use initialPage prop if provided, otherwise restore saved page or start at page 1
                  const savedPage = getSavedPage();
                  const targetPage = initialPage || savedPage;
                  const finalPage = Math.min(targetPage, e.doc.numPages); // Ensure page exists
                  setCurrentPage(finalPage);
                  
                  console.log(`PDF loaded: ${e.doc.numPages} pages, starting at page: ${initialPage}`);
                }}
                onPageChange={(e) => {
                  const newPage = e.currentPage + 1; // Convert from 0-indexed
                  setCurrentPage(newPage);
                  saveCurrentPage(newPage); // Immediate save for faster navigation
                  onPageChange?.(newPage); // Notify parent component
                  console.log(`Current page: ${newPage}`);
                }}
              />
            </Worker>
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