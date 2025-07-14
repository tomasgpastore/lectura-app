import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Layout/Header';
import { PageLoader } from '../components/Layout/PageLoader';
import { 
  FileManager, 
  DocumentPreview, 
  ChatInterface, 
  RemoveDocumentModal,
  EditDocumentModal,
  DeleteErrorModal
} from '../components/Class';
import { useDocumentManager } from '../lib/hooks/useDocumentManager';
import { useChatManager } from '../lib/hooks/useChatManager';
import { useResizeManager } from '../lib/hooks/useResizeManager';
import { courseApi, slideApi } from '../lib/api/api';

export const Class: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isFileManagerCollapsed, setIsFileManagerCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch course data with better caching while ensuring data loads
  const { data: course, isLoading: courseLoading, error: courseError } = useQuery({
    queryKey: ['course', id],
    queryFn: () => courseApi.getById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  // Use fetched data primarily, with cache as fallback only for errors
  const displayCourse = course || queryClient.getQueryData(['course', id!]);

  // Fetch all slides for the course with better caching
  const { data: allSlides = [], isLoading: slidesLoading } = useQuery({
    queryKey: ['slides', id],
    queryFn: () => slideApi.getAll(id!),
    enabled: !!id && !!displayCourse,
    staleTime: 5 * 60 * 1000, // Consider slides fresh for 5 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
    refetchOnWindowFocus: false,
  });

  // Filter slides based on search query (local filtering for instant results)
  const filteredSlides = allSlides.filter(slide =>
    slide.originalFileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Custom hooks for functionality
  const documentManager = useDocumentManager(id, filteredSlides);
  const chatManager = useChatManager(id, documentManager.selectedDocument, documentManager.currentPage);
  const resizeManager = useResizeManager();

  // Handle opening file from source citation
  const handleOpenInFile = (s3FileName: string, pageStart: number, rawText: string) => {
    console.log(`Opening file: ${s3FileName}, page: ${pageStart}`);
    // Extract slide ID from s3_file_name (format: courses/{courseId}/slides/{slideId}.pdf)
    const slideIdMatch = s3FileName.match(/slides\/([^\/]+)\.pdf$/);
    if (slideIdMatch) {
      const slideId = slideIdMatch[1];
      const slide = allSlides.find(s => s.id === slideId);
      if (slide) {
        console.log(`Found slide: ${slide.originalFileName}, navigating to page ${pageStart}`);
        
        // Check if this document is already selected
        const isAlreadySelected = documentManager.selectedDocument?.id === slide.id;
        
        if (isAlreadySelected) {
          console.log(`Document already selected, just changing page to ${pageStart}`);
          // Document is already open, just change the page
          documentManager.setCurrentPage(pageStart);
        } else {
          console.log(`Selecting new document and navigating to page ${pageStart}`);
          // Convert slide to document format and set as selected
          const document = {
            id: slide.id,
            name: slide.originalFileName,
            type: slide.contentType,
            size: slide.fileSize,
            uploadedAt: new Date(slide.uploadTimestamp),
          };
          documentManager.setSelectedDocument(document);
          documentManager.setCurrentPage(pageStart);
        }
      } else {
        console.log(`Slide not found for ID: ${slideId}`);
      }
    } else {
      console.log(`Invalid s3 file name format: ${s3FileName}`);
    }
  };



  // Show file management only when no document is previewed
  const showFileManagement = !documentManager.selectedDocument;

  // Debug logging in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Class component state:', {
        id,
        courseLoading,
        course: !!course,
        displayCourse: !!displayCourse,
        courseError: !!courseError,
        slidesLoading
      });
    }
  }, [id, courseLoading, course, displayCourse, courseError, slidesLoading]);

  // Determine if we're in a loading state - be more permissive
  const isPageLoading = courseLoading && !displayCourse;

  // Error state
  if (courseError && !displayCourse) {
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-lg text-red-600 dark:text-red-400">
          Failed to load course
        </div>
      </div>
    );
  }

  // Show loading state
  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600 dark:text-gray-400">Loading course...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen bg-blue-50 dark:bg-neutral-900 flex flex-col ${resizeManager.isResizing ? 'cursor-col-resize' : ''}`}>
        <Header 
          courseName={(displayCourse as any)?.name || 'Loading...'}
          courseCode={(displayCourse as any)?.code || ''}
          lightBlueTheme={true}
        />

        {/* Main Layout - Full Screen with top padding for fixed header */}
        <div className="flex-1 flex pt-16 main-content-container min-h-0">
        {/* File Management Block */}
        {showFileManagement && (
          <FileManager
            documents={documentManager.documents}
            isCollapsed={isFileManagerCollapsed}
            onToggleCollapse={() => setIsFileManagerCollapsed(!isFileManagerCollapsed)}
            onFilesUploaded={documentManager.handleFilesUploaded}
            onPreviewDocument={documentManager.handlePreviewDocument}
            onDeleteConfirmation={documentManager.handleDeleteConfirmation}
            onEditDocument={documentManager.handleEditDocument}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}

        {/* Document Preview */}
        {documentManager.selectedDocument && (
          <>
            <div className="p-2 h-full" style={{ width: `${resizeManager.previewWidth}%` }}>
              <DocumentPreview
                document={documentManager.selectedDocument}
                onClose={() => documentManager.setSelectedDocument(null)}
                onAddToChat={(text) => {
                  const currentInput = chatManager.inputMessage;
                  const newInput = currentInput ? `${currentInput}\n\n"${text}"` : `"${text}"`;
                  chatManager.handleInputChange(newInput);
                }}
                onPageChange={documentManager.handlePageChange}
                initialPage={documentManager.currentPage}
              />
            </div>
            
            {/* Resize Handle */}
            <div className="py-2 flex items-center">
              <div 
                className="w-1 h-full bg-gray-300 dark:bg-neutral-600 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize transition-colors"
                onMouseDown={resizeManager.handleMouseDown}
              />
            </div>
          </>
        )}

        {/* Chat Interface Block */}
        <div className="flex-1 p-2 h-full" style={{ width: documentManager.selectedDocument ? `${100 - resizeManager.previewWidth}%` : '100%' }}>
          <ChatInterface
            messages={chatManager.messages}
            isAiLoading={chatManager.isAiLoading}
            inputMessage={chatManager.inputMessage}
            onInputChange={chatManager.handleInputChange}
            onSubmit={chatManager.handleSubmit}
            onClearChat={chatManager.handleClearChat}
            streamingMessageIds={chatManager.streamingMessageIds}
            onOpenInFile={handleOpenInFile}
          />
        </div>
      </div>

      {/* Remove Document Modal */}
      <RemoveDocumentModal
        isOpen={documentManager.isDeleteModalOpen}
        onClose={documentManager.handleCloseDeleteModal}
        onRemoveDocument={documentManager.handleDeleteDocument}
        document={documentManager.documentToDelete}
      />

      {/* Edit Document Modal */}
      <EditDocumentModal
        isOpen={documentManager.isEditModalOpen}
        onClose={documentManager.handleCloseEditModal}
        onUpdateDocument={documentManager.handleUpdateDocument}
        document={documentManager.documentToEdit}
      />

      {/* Delete Error Modal */}
      <DeleteErrorModal
        isOpen={documentManager.showDeleteError}
        onClose={documentManager.handleCloseDeleteError}
        errorMessage={documentManager.deleteErrorMessage}
      />

      {/* Upload Error Modal */}
      <DeleteErrorModal
        isOpen={documentManager.showUploadError}
        onClose={documentManager.handleCloseUploadError}
        errorMessage={documentManager.uploadErrorMessage}
      />
    </div>
  );
}; 