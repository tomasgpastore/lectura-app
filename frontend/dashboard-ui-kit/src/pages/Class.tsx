import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Layout/Header';
import { 
  FileManager, 
  ChatInterface, 
  RemoveDocumentModal,
  EditDocumentModal,
  DeleteErrorModal
} from '../components/Class';
import { DocumentPreview } from '../components/Class/DocumentPreview';
import { useDocumentManager } from '../lib/hooks/useDocumentManager';
import { useChatManager } from '../lib/hooks/useChatManager';
import { courseApi, slideApi } from '../lib/api/api';

// Memoized components to prevent unnecessary re-renders
const MemoizedChatInterface = React.memo(ChatInterface);
const MemoizedFileManager = React.memo(FileManager);

export const Class: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isFileManagerCollapsed, setIsFileManagerCollapsed] = useState(false);
  const [selectedTextForChat, setSelectedTextForChat] = useState<string>('');


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

  // Custom hooks for functionality
  const documentManager = useDocumentManager(id, allSlides);
  const chatManager = useChatManager(id, documentManager.selectedDocument);


  // Handle opening file from source citation
  const handleOpenInFile = (s3FileName: string, pageStart: number) => {
    console.log(`Opening file: ${s3FileName}, page: ${pageStart}`);
    // Extract slide ID from s3_file_name (format: courses/{courseId}/slides/{slideId}.pdf)
    const slideIdMatch = s3FileName.match(/slides\/([^/]+)\.pdf$/);
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

  // Set selected text for chat (new approach - for cloud popup)
  const setSelectedTextForChatHandler = (text: string) => {
    setSelectedTextForChat(text);
  };

  // Clear selected text
  const clearSelectedText = () => {
    setSelectedTextForChat('');
  };

  // Handle form submission with combined text
  const handleCombinedSubmit = (e: React.FormEvent, inputValue: string, selectedText?: string) => {
    e.preventDefault();
    
    // Combine the input message and selected text
    let combinedMessage = inputValue.trim();
    
    if (selectedText && selectedText.trim()) {
      combinedMessage = combinedMessage 
        ? `${combinedMessage}\n\n"${selectedText}"`
        : `"${selectedText}"`;
    }
    
    if (combinedMessage) {
      // Use the new method to send with custom message
      chatManager.handleSubmitWithMessage(combinedMessage);
      
      // Clear both inputs
      chatManager.handleInputChange('');
      clearSelectedText();
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
    <div className="h-screen bg-blue-50 dark:bg-neutral-900 flex flex-col">
      <Header 
        courseName={(displayCourse as { name?: string })?.name || 'Loading...'}
        courseCode={(displayCourse as { code?: string })?.code || ''}
        lightBlueTheme={true}
      />

      <style>
        {`
          /* Custom yellow scrollbar styles */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          ::-webkit-scrollbar-track {
            background: #f8f9fa;
            border-radius: 4px;
          }
          
          ::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #FFD700, #FFC700);
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, #FFC700, #FFB000);
          }

          /* Modern button styles */
          .modern-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 8px;
            color: white;
            padding: 8px 16px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
            margin: 0 4px;
          }
          
          .modern-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }
          
          .modern-btn:active {
            transform: translateY(0);
          }
          
          .modern-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }

        `}
      </style>

      {/* Main Layout - Full Screen with top padding for fixed header */}
      <div className="flex-1 flex pt-16 main-content-container min-h-0">
        {/* File Upload Section - only show when no document selected */}
        {showFileManagement && (
          <MemoizedFileManager
            documents={documentManager.documents}
            isLoading={slidesLoading}
            isCollapsed={isFileManagerCollapsed}
            onToggleCollapse={() => setIsFileManagerCollapsed(!isFileManagerCollapsed)}
            onFilesUploaded={documentManager.handleFilesUploaded}
            onPreviewDocument={documentManager.handlePreviewDocument}
            onDeleteConfirmation={documentManager.handleDeleteConfirmation}
            onEditDocument={documentManager.handleEditDocument}
          />
        )}

        {/* Document Preview Section - replace file upload when document is selected */}
        {documentManager.selectedDocument && (
          <div style={{ display: 'flex', height: '100%', width: '100%' }}>
            <DocumentPreview
              document={documentManager.selectedDocument}
              onClose={() => documentManager.setSelectedDocument(null)}
              onSetSelectedTextForChat={setSelectedTextForChatHandler}
              onPageChange={documentManager.setCurrentPage}
              initialPage={documentManager.currentPage}
              courseId={id}
            >
              <MemoizedChatInterface
                messages={chatManager.messages}
                isAiLoading={chatManager.isAiLoading}
                inputMessage={chatManager.inputMessage}
                onInputChange={chatManager.handleInputChange}
                onSubmit={(e) => handleCombinedSubmit(e, chatManager.inputMessage, selectedTextForChat)}
                onClearChat={chatManager.handleClearChat}
                streamingMessageIds={chatManager.streamingMessageIds}
                onOpenInFile={handleOpenInFile}
                slides={allSlides}
                selectedTextForChat={selectedTextForChat}
                onClearSelectedText={clearSelectedText}
              />
            </DocumentPreview>
          </div>
        )}

        {/* Chat Only Section - when no document selected */}
        {!documentManager.selectedDocument && (
          <div className="flex-1 p-2 h-full">
            <MemoizedChatInterface
              messages={chatManager.messages}
              isAiLoading={chatManager.isAiLoading}
              inputMessage={chatManager.inputMessage}
              onInputChange={chatManager.handleInputChange}
              onSubmit={(e) => handleCombinedSubmit(e, chatManager.inputMessage, selectedTextForChat)}
              onClearChat={chatManager.handleClearChat}
              streamingMessageIds={chatManager.streamingMessageIds}
              onOpenInFile={handleOpenInFile}
              slides={allSlides}
              selectedTextForChat={selectedTextForChat}
              onClearSelectedText={clearSelectedText}
            />
          </div>
        )}
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