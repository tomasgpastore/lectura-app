import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, X, ChevronLeft, ChevronRight, Bookmark } from 'lucide-react';
import { debounce } from '../../utils/debounce';
import { Document } from '../../types';
import { slideApi } from '../../lib/api/api';
import { useParams, useLocation } from 'react-router-dom';

// Core imports
import { Viewer, Worker, SpecialZoomLevel, ScrollMode, SetRenderRange, VisiblePagesRange } from '@react-pdf-viewer/core';

// Plugin imports
import { bookmarkPlugin } from '@react-pdf-viewer/bookmark';
import { highlightPlugin, RenderHighlightTargetProps, Trigger } from '@react-pdf-viewer/highlight';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { scrollModePlugin } from '@react-pdf-viewer/scroll-mode';
import { zoomPlugin } from '@react-pdf-viewer/zoom';

// Import CSS files
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/bookmark/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';
import '@react-pdf-viewer/zoom/lib/styles/index.css';

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

  delete(key: string): void {
    if (this.cache.has(key)) {
      const url = this.cache.get(key);
      if (url) {
        URL.revokeObjectURL(url);
      }
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }
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
  const [currentPage, setCurrentPage] = useState<number>(() => {
    // Initialize with saved page or initialPage prop
    if (initialPage) return initialPage;
    if (courseId && document.id) {
      const saved = localStorage.getItem(`pdf-page-${courseId}-${document.id}`);
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });
  const [numPages, setNumPages] = useState<number>(0);
  const [showBookmarks, setShowBookmarks] = useState<boolean>(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalHeight, setTotalHeight] = useState<number>(0);
  const [pageHeight, setPageHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const cacheKey = `${courseId}_${document.id}`;
  
  // Check if this is a PDF file
  const isPDF = document.type.toLowerCase().includes('pdf') || 
                document.name.toLowerCase().endsWith('.pdf');

  // Debug logging
  console.log('Current state:', { loading, error, pdfUrl: !!pdfUrl, isPDF, courseId, documentType: document.type, documentName: document.name });

  // Create plugins with optimizations
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;
  
  // Enhanced bookmark plugin with instant navigation
  const bookmarkPluginInstance = bookmarkPlugin();
  const { Bookmarks } = bookmarkPluginInstance;
  
  const zoomPluginInstance = zoomPlugin();
  const { zoomTo } = zoomPluginInstance;
  
  const scrollModePluginInstance = scrollModePlugin();

  // Virtual rendering optimization - only render visible pages + buffer
  const setRenderRange: SetRenderRange = useCallback((visiblePagesRange: VisiblePagesRange) => {
    // Render visible pages plus 5 pages before and after for smooth scrolling
    // This significantly improves performance for large documents
    const optimizedRange = {
      startPage: Math.max(0, visiblePagesRange.startPage - 5),
      endPage: visiblePagesRange.endPage + 5,
    };
    
    console.log('Virtual rendering optimization:', {
      visible: visiblePagesRange,
      optimized: optimizedRange,
      totalRendered: optimizedRange.endPage - optimizedRange.startPage + 1
    });
    
    return optimizedRange;
  }, []);

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

  // Advanced height calculation that works with all document types
  const calculateTotalHeight = useCallback(async (doc: any) => {
    if (!doc || !containerRef.current) return;
    
    try {
      console.log('Starting height calculation for', doc.numPages, 'pages');
      
      // Get container width for scaling calculations
      const containerWidth = containerRef.current.clientWidth - 32;
      
      // Calculate heights for ALL pages (handles different page sizes properly)
      const pageHeights: number[] = [];
      let totalHeightSum = 0;
      
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        
        // Calculate the actual scale being used
        const scale = containerWidth / viewport.width;
        const finalScale = Math.max(0.3, scale);
        
        // Get the scaled height for this specific page
        const scaledHeight = viewport.height * finalScale;
        pageHeights.push(scaledHeight);
        totalHeightSum += scaledHeight;
      }
      
      // Calculate total with realistic gaps
      const pageGap = 8; // react-pdf-viewer's default gap
      const viewerPadding = 20; // Top and bottom padding
      const totalGaps = Math.max(0, doc.numPages - 1) * pageGap;
      
      const calculatedTotal = totalHeightSum + totalGaps + viewerPadding;
      
      // Store individual page height for reference (average)
      const avgPageHeight = totalHeightSum / doc.numPages;
      setPageHeight(avgPageHeight);
      setTotalHeight(calculatedTotal);
      
      console.log('Height calculation complete:', {
        numPages: doc.numPages,
        pageHeights: pageHeights.slice(0, 3), // Show first 3 pages
        avgPageHeight,
        totalHeightSum,
        totalGaps,
        calculatedTotal,
        containerWidth,
        scale: containerWidth / pageHeights[0] // Sample scale
      });
      
      // Enhanced measurement verification after rendering
      setTimeout(() => {
        measureAndAdjustHeight(calculatedTotal);
      }, 1500); // Longer delay for complex documents
      
    } catch (error) {
      console.error('Error calculating total height:', error);
      // Enhanced fallback based on document type detection
      const estimatedPageHeight = 842; // A4 at typical scale
      const buffer = 100;
      const fallbackTotal = (estimatedPageHeight * doc.numPages) + buffer;
      setTotalHeight(fallbackTotal);
      setPageHeight(estimatedPageHeight);
    }
  }, []);

  // Measure actual rendered height and adjust if needed
  const measureAndAdjustHeight = useCallback((estimatedHeight: number) => {
    if (!viewerRef.current) return;
    
    try {
      // Find all rendered page elements
      const pageElements = viewerRef.current.querySelectorAll('[data-testid^="core__page-layer-"]');
      
      if (pageElements.length > 0) {
        // Get the bounds of all pages
        const firstPage = pageElements[0];
        const lastPage = pageElements[pageElements.length - 1];
        
        const firstRect = firstPage.getBoundingClientRect();
        const lastRect = lastPage.getBoundingClientRect();
        const viewerRect = viewerRef.current.getBoundingClientRect();
        
        // Calculate actual content height
        const actualContentHeight = (lastRect.bottom - firstRect.top) + 40; // Small buffer
        
        // Use the larger of estimated vs actual height
        const finalHeight = Math.max(estimatedHeight, actualContentHeight);
        
        if (Math.abs(finalHeight - estimatedHeight) > 50) { // Only update if significant difference
          console.log('Adjusting height after measurement:', {
            estimated: estimatedHeight,
            measured: actualContentHeight,
            final: finalHeight,
            renderedPages: pageElements.length
          });
          setTotalHeight(finalHeight);
        }
      }
    } catch (error) {
      console.error('Error measuring actual height:', error);
    }
  }, []);

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
          const finalZoom = Math.max(0.3, targetZoom);
          
          zoomTo(finalZoom);
          
          // Recalculate total height when zoom changes
          setTimeout(() => {
            calculateTotalHeight(pdfDoc);
          }, 200); // Small delay to allow zoom to take effect
          
        } catch (error) {
          console.error('Error getting page dimensions:', error);
          // Fallback
          const containerWidth = containerRef.current.clientWidth - 32;
          const targetZoom = containerWidth / 595;
          const finalZoom = Math.max(0.3, targetZoom);
          zoomTo(finalZoom);
          
          // Fallback height calculation
          setTimeout(() => {
            calculateTotalHeight(pdfDoc);
          }, 200);
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(() => {
        updateScale();
        // Also recalculate height on container resize
        if (pdfDoc) {
          setTimeout(() => {
            calculateTotalHeight(pdfDoc);
          }, 300); // Additional delay after scale update
        }
      }, 50);
    });

    resizeObserver.observe(containerRef.current);

    // Initial scale
    updateScale();

    return () => {
      resizeObserver.disconnect();
    };
  }, [zoomTo, pdfDoc, calculateTotalHeight]);

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
          pdfCache.delete(cacheKey);
        }
      }
    };
  }, [location.pathname, cacheKey, currentPage]);

  // Download PDF to browser to handle S3 expiration
  useEffect(() => {
    const loadPdfUrl = async () => {
      console.log('loadPdfUrl effect running', { isPDF, courseId, document: document.name });
      if (!isPDF || !courseId) {
        console.log('Not PDF or no courseId, setting loading to false');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Check cache first
        const cachedUrl = pdfCache.get(cacheKey);
        if (cachedUrl) {
          console.log('Using cached PDF');
          setPdfUrl(cachedUrl);
          setLoading(false);
          return;
        }

        console.log('Downloading PDF to browser...');
        
        // Fetch PDF and create blob URL to handle S3 expiration
        const presignedUrl = await slideApi.getPresignedUrl(courseId, document.id);
        console.log('Got presigned URL:', presignedUrl);
        const response = await fetch(presignedUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status}`);
        }
        
        // Download the entire PDF to browser memory
        const blob = await response.blob();
        console.log(`PDF downloaded: ${blob.size} bytes`);
        
        // Create permanent blob URL that won't expire
        const blobUrl = URL.createObjectURL(blob);
        console.log('Created blob URL:', blobUrl);
        
        // Cache the URL for better performance
        pdfCache.set(cacheKey, blobUrl);
        setPdfUrl(blobUrl);
        
        console.log('PDF ready for viewing');
        
      } catch (err) {
        console.error('Failed to load PDF:', err);
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

  // Simple page navigation using jumpToPage with instant navigation
  const goToPrevPage = useCallback(() => {
    console.log('goToPrevPage:', { currentPage, numPages, jumpToPage: !!jumpToPage });
    if (currentPage > 1 && jumpToPage) {
      const targetPage = currentPage - 1;
      const zeroIndexedTarget = targetPage - 1;
      console.log('Jumping to previous page:', targetPage, '(0-indexed:', zeroIndexedTarget, ')');
      
      // Only call jumpToPage, let onPageChange handle state updates
      jumpToPage(zeroIndexedTarget);
    }
  }, [currentPage, jumpToPage]);

  const goToNextPage = useCallback(() => {
    console.log('goToNextPage:', { currentPage, numPages, jumpToPage: !!jumpToPage });
    if (currentPage < numPages && jumpToPage) {
      const targetPage = currentPage + 1;
      const zeroIndexedTarget = targetPage - 1;
      console.log('Jumping to next page:', targetPage, '(0-indexed:', zeroIndexedTarget, ')');
      
      // Only call jumpToPage, let onPageChange handle state updates
      jumpToPage(zeroIndexedTarget);
    }
  }, [currentPage, numPages, jumpToPage]);

  // Function to jump to specific page instantly
  const jumpToPageInstant = useCallback((pageNumber: number) => {
    if (!jumpToPage || pageNumber < 1 || pageNumber > numPages) return;
    
    const zeroIndexedPage = pageNumber - 1;
    console.log('Instant jump to page:', pageNumber, '(0-indexed:', zeroIndexedPage, ')');
    
    // Only call jumpToPage, let onPageChange handle state updates
    jumpToPage(zeroIndexedPage);
  }, [jumpToPage, numPages]);

  const toggleBookmarks = useCallback(() => {
    setShowBookmarks(!showBookmarks);
  }, [showBookmarks]);

  const handleClose = useCallback(() => {
    // Save current page before closing
    saveCurrentPage(currentPage);
    onClose();
  }, [currentPage, saveCurrentPage, onClose]);

  // Keyboard navigation enabled for better UX
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextPage();
      }
    };

    // Only add event listener when PDF is loaded and viewer is active
    if (pdfUrl && !loading && !error && numPages > 0) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [pdfUrl, loading, error, numPages, goToPrevPage, goToNextPage]);



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
    if (initialPage && jumpToPageInstant && numPages > 0 && initialPage !== prevInitialPageRef.current) {
      const targetPage = Math.min(Math.max(1, initialPage), numPages);
      if (targetPage > 0 && targetPage !== currentPage) {
        console.log(`Jumping to page ${targetPage} from source navigation (previous: ${prevInitialPageRef.current}, current: ${currentPage})`);
        
        // Use instant navigation for external page requests
        setTimeout(() => {
          jumpToPageInstant(targetPage);
        }, 100); // Minimal delay for component stability
        prevInitialPageRef.current = initialPage;
      }
    }
  }, [initialPage, numPages, currentPage, jumpToPageInstant]);

  // Debug effect to track page restoration
  useEffect(() => {
    if (courseId && document.id) {
      const savedPage = getSavedPage();
      console.log(`DocumentPreview mounted for ${document.name}, saved page: ${savedPage}, initialPage: ${initialPage}`);
    }
  }, [courseId, document.id, document.name, initialPage, getSavedPage]);



  return (
    <div className="bg-white dark:bg-neutral-800 dark:border-neutral-700 rounded-xl border flex flex-col h-full max-h-full overflow-hidden">
      {/* Header with custom controls */}
      <div className="p-4 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {document.name}
        </h3>
        <div className="flex items-center space-x-2">
          {/* PDF Controls */}
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
      
      {/* PDF Viewer Container */}
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
            <button 
              onClick={() => {
                setError(null);
                setLoading(true);
              }}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : isPDF && pdfUrl ? (
          <div id={`document-preview-${document.id}`} className="h-full">
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
              {/* Fixed height container to prevent scrollbar changes */}
              <div 
                className="h-full overflow-auto"
                style={{
                  position: 'relative',
                }}
              >
                {/* Virtual spacer to maintain consistent scrollbar */}
                {totalHeight > 0 && (
                  <div 
                    style={{ 
                      height: `${totalHeight}px`,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      pointerEvents: 'none',
                      zIndex: -1
                    }}
                  />
                )}
                
                {/* PDF Viewer */}
                <div ref={viewerRef} className="relative z-10">
                  <Viewer
                  fileUrl={pdfUrl}
                  plugins={[
                    pageNavigationPluginInstance,
                    bookmarkPluginInstance, 
                    zoomPluginInstance,
                    highlightPluginInstance,
                    scrollModePluginInstance
                  ]}
                  defaultScale={SpecialZoomLevel.PageFit}
                  scrollMode={ScrollMode.Vertical}
                  enableSmoothScroll={false}
                  initialPage={0}
                  setRenderRange={setRenderRange}
                  renderLoader={(percentages: number) => (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
                        <p className="text-gray-500 dark:text-gray-400">
                          Loading document... {Math.round(percentages)}%
                        </p>
                      </div>
                    </div>
                  )}
                  onDocumentLoad={(e) => {
                    console.log('Document loaded successfully!', e.doc.numPages, 'pages');
                    setNumPages(e.doc.numPages);
                    setPdfDoc(e.doc);
                    
                    // Calculate total height immediately to prevent scrollbar changes
                    calculateTotalHeight(e.doc);
                    
                    // Navigate to saved/initial page with reduced delay
                    setTimeout(() => {
                      const savedPage = getSavedPage();
                      const targetPage = initialPage || savedPage;
                      const finalPage = Math.min(Math.max(1, targetPage), e.doc.numPages);
                      
                      console.log('Navigating to initial page:', { savedPage, initialPage, finalPage });
                      
                      if (finalPage > 1) {
                        jumpToPageInstant(finalPage);
                      }
                    }, 500); // Reduced delay for faster navigation
                  }}
                  onPageChange={(e) => {
                    console.log('Page changed to:', e.currentPage + 1);
                    const newPage = e.currentPage + 1;
                    setCurrentPage(newPage);
                    
                    if (courseId && document.id) {
                      localStorage.setItem(`pdf-page-${courseId}-${document.id}`, newPage.toString());
                    }
                    
                    onPageChange?.(newPage);
                  }}
                />
                </div>
              </div>
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