import { Viewer, Worker, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import { bookmarkPlugin } from '@react-pdf-viewer/bookmark';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { selectionModePlugin } from '@react-pdf-viewer/selection-mode';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { slideApi } from '../../lib/api/api';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Bookmark } from 'lucide-react';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/zoom/lib/styles/index.css';
import '@react-pdf-viewer/bookmark/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';
import '@react-pdf-viewer/selection-mode/lib/styles/index.css';

interface Document {
  id: string;
  name: string;
  type: string;
}

interface DocumentPreviewProps {
  document: Document;
  onClose: () => void;
  onAddToChat?: (text: string) => void;
  onSetSelectedTextForChat?: (text: string) => void;
  onPageChange?: (currentPage: number) => void;
  initialPage?: number;
  courseId?: string;
  children?: React.ReactNode;
}

export const DocumentPreview = ({ document: doc, onClose, onAddToChat, onSetSelectedTextForChat, onPageChange, initialPage, courseId: propsCourseId, children }: DocumentPreviewProps) => {
  const { id: paramsCourseId } = useParams<{ id: string }>();
  // Use the courseId from props if provided, otherwise fall back to URL params
  const courseId = propsCourseId || paramsCourseId;
  
  // Create plugins
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;
  
  const zoomPluginInstance = zoomPlugin();
  const { zoomTo } = zoomPluginInstance;
  
  const bookmarkPluginInstance = bookmarkPlugin();
  const { Bookmarks } = bookmarkPluginInstance;

  const selectionModePluginInstance = selectionModePlugin();
  
  // State management
  const [currentPage, setCurrentPage] = useState<number>(initialPage || 1);
  const [numPages, setNumPages] = useState<number>(0);
  const [showBookmarks, setShowBookmarks] = useState<boolean>(false);
  const [isEditingPage, setIsEditingPage] = useState<boolean>(false);
  const [pageInputValue, setPageInputValue] = useState<string>('1');
  const [currentZoom, setCurrentZoom] = useState<number>(1);
  const [previewWidth, setPreviewWidth] = useState<number>(50); // percentage
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const bookmarkRef = useRef<HTMLDivElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);

  // Use React Query to fetch presigned URL - this will deduplicate requests
  const { data: pdfUrl, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['presigned-url', courseId, doc?.id],
    queryFn: () => {
      return slideApi.getPresignedUrl(courseId!, doc.id);
    },
    enabled: !!courseId && !!doc?.id,
    staleTime: 5 * 60 * 1000, // Consider URL fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });
  
  // Handle document not found error
  useEffect(() => {
    if (queryError && (queryError as any)?.response?.status === 404) {
      onClose();
    }
  }, [queryError, onClose]);

  const error = queryError ? (queryError as any)?.response?.status === 404 ? 'Document not found' : 'Failed to load document' : null;

  // Reset initial load flag when document changes
  useEffect(() => {
    setIsInitialLoad(true);
  }, [doc?.id]);

  // Handle external page changes (e.g., from "Open in file" button)
  useEffect(() => {
    if (initialPage && jumpToPage && numPages > 0 && !isInitialLoad) {
      // Only jump to page if it's different from current page
      if (initialPage !== currentPage && initialPage >= 1 && initialPage <= numPages) {
        jumpToPage(initialPage - 1); // jumpToPage is 0-indexed
        setCurrentPage(initialPage);
        setPageInputValue(initialPage.toString());
      }
    }
  }, [initialPage, jumpToPage, numPages, isInitialLoad]);

  // Navigation functions
  const goToPrevPage = () => {
    if (currentPage > 1 && jumpToPage) {
      jumpToPage(currentPage - 2); // jumpToPage is 0-indexed
    }
  };

  const goToNextPage = () => {
    if (currentPage < numPages && jumpToPage) {
      jumpToPage(currentPage); // jumpToPage is 0-indexed
    }
  };

  // Page input functions
  const handlePageClick = () => {
    setIsEditingPage(true);
    setPageInputValue(currentPage.toString());
    setTimeout(() => {
      pageInputRef.current?.focus();
      pageInputRef.current?.select();
    }, 0);
  };

  const handlePageInputSubmit = () => {
    const page = parseInt(pageInputValue);
    if (page >= 1 && page <= numPages && jumpToPage) {
      jumpToPage(page - 1); // jumpToPage is 0-indexed
    }
    setIsEditingPage(false);
  };

  const handlePageInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingPage(false);
      setPageInputValue(currentPage.toString());
    }
  };

  const handlePageInputBlur = () => {
    handlePageInputSubmit();
  };

  // Zoom functions
  const handleZoomIn = () => {
    const newZoom = Math.min(currentZoom * 1.2, 3);
    if (zoomTo) {
      zoomTo(newZoom);
      setCurrentZoom(newZoom);
    }
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(currentZoom / 1.2, 0.3);
    if (zoomTo) {
      zoomTo(newZoom);
      setCurrentZoom(newZoom);
    }
  };

  const handleAutoZoom = () => {
    if (zoomTo) {
      zoomTo(SpecialZoomLevel.PageWidth);
    }
  };

  // Bookmark functions
  const toggleBookmarks = () => {
    setShowBookmarks(!showBookmarks);
  };

  // Handle text selection in PDF
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() && (onAddToChat || onSetSelectedTextForChat)) {
        const selectedText = selection.toString().trim();
        
        // Check if the selection is within the PDF viewer container
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const pdfContainer = document.querySelector('.rpv-core__viewer');
        
        // Only show button if selection is within PDF content
        const isWithinPdf = pdfContainer && (pdfContainer.contains(container) || pdfContainer.contains(container.parentElement));
        
        if (isWithinPdf) {
          setSelectedText(selectedText);
          
          // Get selection position - position button next to cursor
          const rect = range.getBoundingClientRect();
          setSelectionPosition({
            x: rect.right + 10, // Position next to the end of selection
            y: rect.top + rect.height / 2 // Center vertically with selection
          });
        } else {
          setSelectedText('');
          setSelectionPosition(null);
        }
      } else {
        setSelectedText('');
        setSelectionPosition(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [onAddToChat, onSetSelectedTextForChat]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bookmarkRef.current && !bookmarkRef.current.contains(event.target as Node)) {
        setShowBookmarks(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Resize functions
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const container = document.querySelector('.main-content-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const newWidth = Math.max(25, Math.min(75, ((e.clientX - rect.left) / rect.width) * 100));
    setPreviewWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Setup resize listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  // Sync page input value when current page changes
  useEffect(() => {
    if (!isEditingPage) {
      setPageInputValue(currentPage.toString());
    }
  }, [currentPage, isEditingPage]);

  // Save current page position when page changes (but not during initial load)
  useEffect(() => {
    if (doc?.id && currentPage > 0 && !isInitialLoad) {
      // Don't save to localStorage - let parent component handle state
      // saveDocumentPosition(doc.id, currentPage);
    }
  }, [currentPage, doc?.id, isInitialLoad]);


  // Handle adding selected text to chat
  const handleAddToChat = () => {
    if (selectedText) {
      // Use new approach with cloud popup if onSetSelectedTextForChat is provided
      if (onSetSelectedTextForChat) {
        onSetSelectedTextForChat(selectedText);
      } 
      // Fallback to old approach for backward compatibility
      else if (onAddToChat) {
        onAddToChat(selectedText);
      }
      
      // Clear selection
      setSelectedText('');
      setSelectionPosition(null);
      window.getSelection()?.removeAllRanges();
    }
  };


  // Handle close with saving position
  const handleClose = () => {
    if (doc?.id && currentPage > 0) {
      // Don't save to localStorage - let parent component handle state
      // saveDocumentPosition(doc.id, currentPage);
    }
    onClose();
  };

  // Add validation for document
  if (!doc) {
    return (
      <div className="bg-white dark:bg-neutral-800 dark:border-neutral-700 rounded-xl border flex flex-col h-full max-h-full overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 dark:text-gray-400">No document selected</p>
        </div>
      </div>
    );
  }

  // If children are provided, render split layout
  if (children) {
    return (
      <>
        <style>{`
          /* Hide number input arrows */
          input[type="number"]::-webkit-outer-spin-button,
          input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          
          input[type="number"] {
            -moz-appearance: textfield;
          }

        `}</style>
        
        <div className="flex h-full w-full" style={{ cursor: isResizing ? 'col-resize' : 'default' }}>
          {/* PDF Viewer */}
          <div className="h-full" style={{ width: `${previewWidth}%`, minWidth: '450px' }}>
            <div className="bg-white dark:bg-neutral-800 rounded-xl flex flex-col h-full max-h-full overflow-hidden">
        {/* Header with controls */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {doc.name}
        </h3>
        
        <div className="flex items-center space-x-2">
          {/* PDF Controls */}
          {!loading && !error && numPages > 0 && (
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
                
                <div className="text-sm text-gray-500 dark:text-gray-400 min-w-20 text-center flex items-center justify-center">
                  {isEditingPage ? (
                    <input
                      ref={pageInputRef}
                      type="number"
                      value={pageInputValue}
                      onChange={(e) => setPageInputValue(e.target.value)}
                      onKeyDown={handlePageInputKeyPress}
                      onBlur={handlePageInputBlur}
                      className="w-12 text-center bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      min="1"
                      max={numPages}
                    />
                  ) : (
                    <span 
                      onClick={handlePageClick}
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700 px-2 py-1 rounded transition-colors"
                    >
                      {currentPage}
                    </span>
                  )}
                  <span className="mx-1">/</span>
                  <span>{numPages}</span>
                </div>
                
                <button
                  onClick={goToNextPage}
                  disabled={currentPage >= numPages}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next page (→ or ↓)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                
                <button
                  onClick={handleAutoZoom}
                  className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-neutral-700 rounded-lg min-w-16 text-center hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
                  title="Auto zoom (Page Width)"
                >
                  Auto
                </button>
                
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
              
              <div className="relative" ref={bookmarkRef}>
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
      <div id={`document-preview-${doc.id}`} className="flex-1 overflow-hidden bg-gray-50 dark:bg-neutral-900 min-h-0 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">Loading document...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
            <button 
              onClick={() => refetch()}
              className="px-4 py-2 bg-[#F97316] text-white rounded-lg hover:bg-[#F97316]/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : pdfUrl ? (
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
            <Viewer
              fileUrl={pdfUrl}
              defaultScale={SpecialZoomLevel.PageWidth}
              plugins={[pageNavigationPluginInstance, zoomPluginInstance, bookmarkPluginInstance, selectionModePluginInstance]}
              enableSmoothScroll={false}
              onDocumentLoad={(e) => {
                setNumPages(e.doc.numPages);
                // Initialize zoom state
                setCurrentZoom(1);
                
                // Use initialPage prop instead of localStorage
                if (jumpToPage) {
                  const targetPage = initialPage || 1;
                  setCurrentPage(targetPage);
                  if (targetPage > 1 && targetPage <= e.doc.numPages) {
                    setTimeout(() => {
                      jumpToPage(targetPage - 1); // jumpToPage is 0-indexed
                      // Reset initial load flag after navigating
                      setTimeout(() => {
                        setIsInitialLoad(false);
                      }, 200);
                    }, 100); // Small delay to ensure PDF is fully loaded
                  } else {
                    // If no saved page or invalid page, just reset the flag
                    setTimeout(() => {
                      setIsInitialLoad(false);
                    }, 100);
                  }
                }
              }}
              onPageChange={(e) => {
                const newPage = e.currentPage + 1; // Convert from 0-indexed
                setCurrentPage(newPage);
                onPageChange?.(newPage);
              }}
              onZoom={(e) => {
                setCurrentZoom(e.scale);
              }}
            />
          </Worker>
        ) : null}
      </div>
            </div>
          </div>
          
          {/* Resize Handle */}
          <div className="py-2 flex items-center">
            <div 
              className="w-1 h-full bg-gray-300 dark:bg-neutral-600 hover:bg-orange-600 dark:hover:bg-orange-600 cursor-col-resize transition-colors"
              onMouseDown={handleMouseDown}
            />
          </div>
          
          {/* Chat Interface */}
          <div className="flex-1 h-full">
            {children}
          </div>
        </div>

        {/* Add to Chat Button */}
        {selectedText && selectionPosition && (onAddToChat || onSetSelectedTextForChat) && (
          <button
            onClick={handleAddToChat}
            className="fixed z-50 px-3 py-1.5 bg-[#F97316] hover:bg-[#F97316]/90 text-white text-xs font-medium rounded-lg shadow-lg transition-all duration-200 border border-[#F97316]/50 hover:shadow-xl hover:scale-105"
            style={{
              left: `${selectionPosition.x}px`,
              top: `${selectionPosition.y}px`,
              transform: 'translateY(-50%)'
            }}
          >
            Add to Chat
          </button>
        )}

      </>
    );
  }

  // Single PDF view (no children)
  return (
    <>
      <style>{`
        /* Hide number input arrows */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        input[type="number"] {
          -moz-appearance: textfield;
        }
        
      `}</style>
      
      <div className="bg-white dark:bg-neutral-800 rounded-xl flex flex-col h-full max-h-full overflow-hidden" style={{ minWidth: '420px' }}>
        {/* Header with controls */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {doc.name}
        </h3>
        
        <div className="flex items-center space-x-2">
          {/* PDF Controls */}
          {!loading && !error && numPages > 0 && (
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
                
                <div className="text-sm text-gray-500 dark:text-gray-400 min-w-20 text-center flex items-center justify-center">
                  {isEditingPage ? (
                    <input
                      ref={pageInputRef}
                      type="number"
                      value={pageInputValue}
                      onChange={(e) => setPageInputValue(e.target.value)}
                      onKeyDown={handlePageInputKeyPress}
                      onBlur={handlePageInputBlur}
                      className="w-12 text-center bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      min="1"
                      max={numPages}
                    />
                  ) : (
                    <span 
                      onClick={handlePageClick}
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700 px-2 py-1 rounded transition-colors"
                    >
                      {currentPage}
                    </span>
                  )}
                  <span className="mx-1">/</span>
                  <span>{numPages}</span>
                </div>
                
                <button
                  onClick={goToNextPage}
                  disabled={currentPage >= numPages}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next page (→ or ↓)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                
                <button
                  onClick={handleAutoZoom}
                  className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-neutral-700 rounded-lg min-w-16 text-center hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
                  title="Auto zoom (Page Width)"
                >
                  Auto
                </button>
                
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
              
              <div className="relative" ref={bookmarkRef}>
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
      <div id={`document-preview-${doc.id}`} className="flex-1 overflow-hidden bg-gray-50 dark:bg-neutral-900 min-h-0 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">Loading document...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
            <button 
              onClick={() => refetch()}
              className="px-4 py-2 bg-[#F97316] text-white rounded-lg hover:bg-[#F97316]/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : pdfUrl ? (
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
            <Viewer
              fileUrl={pdfUrl}
              defaultScale={SpecialZoomLevel.PageWidth}
              plugins={[pageNavigationPluginInstance, zoomPluginInstance, bookmarkPluginInstance, selectionModePluginInstance]}
              enableSmoothScroll={false}
              onDocumentLoad={(e) => {
                setNumPages(e.doc.numPages);
                // Initialize zoom state
                setCurrentZoom(1);
                
                // Use initialPage prop instead of localStorage
                if (jumpToPage) {
                  const targetPage = initialPage || 1;
                  setCurrentPage(targetPage);
                  if (targetPage > 1 && targetPage <= e.doc.numPages) {
                    setTimeout(() => {
                      jumpToPage(targetPage - 1); // jumpToPage is 0-indexed
                      // Reset initial load flag after navigating
                      setTimeout(() => {
                        setIsInitialLoad(false);
                      }, 200);
                    }, 100); // Small delay to ensure PDF is fully loaded
                  } else {
                    // If no saved page or invalid page, just reset the flag
                    setTimeout(() => {
                      setIsInitialLoad(false);
                    }, 100);
                  }
                }
              }}
              onPageChange={(e) => {
                const newPage = e.currentPage + 1; // Convert from 0-indexed
                setCurrentPage(newPage);
                onPageChange?.(newPage);
              }}
              onZoom={(e) => {
                setCurrentZoom(e.scale);
              }}
            />
          </Worker>
        ) : null}
      </div>
    </div>
    </>
  );
};
