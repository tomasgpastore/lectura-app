import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Layout/Header';
import { 
  FileManager, 
  ChatContainer, 
  RemoveDocumentModal,
  EditDocumentModal,
  DeleteErrorModal
} from '../components/Class';
import { DocumentPreview } from '../components/Class/DocumentPreview';
import { useDocumentManager } from '../lib/hooks/useDocumentManager';
import { useChatManager } from '../lib/hooks/useChatManager';
import { courseApi, slideApi } from '../lib/api/api';
import { useClassStateStore } from '../stores/classStateStore';

// Memoized components to prevent unnecessary re-renders
const MemoizedChatContainer = React.memo(ChatContainer);
const MemoizedFileManager = React.memo(FileManager);

export const Class: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { getClassState, saveClassState } = useClassStateStore();
  const previousClassIdRef = useRef<string | undefined>();
  const previousStateRef = useRef<any>({});
  
  // Initialize state - we'll update these when id changes
  const [isFileManagerCollapsed, setIsFileManagerCollapsed] = useState(false);
  const [selectedTextForChat, setSelectedTextForChat] = useState<string>('');
  const [chatIndicatorItems, setChatIndicatorItems] = useState<Array<{
    id: string;
    type: 'current-page' | 'document';
    name: string;
    removable: boolean;
  }>>([]);
  const [chatInputValue, setChatInputValue] = useState<string>('');
  const [docsSearchEnabled, setDocsSearchEnabled] = useState<boolean>(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);


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
  
  // Fetch all courses for the /cd command
  const { data: allCourses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseApi.getAll(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Get stored state for current class
  const storedState = id ? getClassState(id) : undefined;
  
  // Custom hooks for functionality
  const documentManager = useDocumentManager(id, allSlides, storedState?.selectedDocumentId, storedState?.currentPage);
  // Extract document IDs from indicator items (only document type, not current-page)
  const priorityDocumentIds = chatIndicatorItems
    .filter(item => item.type === 'document')
    .map(item => item.id);
    
  const chatManager = useChatManager(id, documentManager.selectedDocument, priorityDocumentIds, storedState?.messages);


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
  const handleCombinedSubmit = (message: string, isDocsSearchEnabled?: boolean, isWebSearchEnabled?: boolean) => {
    // The message already contains the selected text from ChatInput
    // so we don't need to add it again here
    const trimmedMessage = message.trim();
    
    if (trimmedMessage) {
      // Use the new method to send with custom message
      chatManager.handleSubmitWithMessage(trimmedMessage, isDocsSearchEnabled, isWebSearchEnabled);
      
      // Clear selected text
      clearSelectedText();
      // Note: chatInputValue will be cleared by the ChatInput component itself
    }
  };

  // Show file management only when no document is previewed
  const showFileManagement = !documentManager.selectedDocument;

  // Function to save current state
  const saveCurrentState = useCallback(() => {
    if (id) {
      const stateToSave = {
        // Document state
        selectedDocumentId: documentManager.selectedDocument?.id,
        currentPage: documentManager.currentPage,
        
        // Chat state
        messages: chatManager.messages,
        streamingMessageIds: chatManager.streamingMessageIds,
        
        // UI state
        isFileManagerCollapsed,
        chatInputValue,
        selectedTextForChat,
        chatIndicatorItems,
        docsSearchEnabled,
        webSearchEnabled,
      };
      
      saveClassState(id, stateToSave);
    }
  }, [id, documentManager.selectedDocument, documentManager.currentPage, 
      chatManager.messages, chatManager.streamingMessageIds,
      isFileManagerCollapsed, chatInputValue, selectedTextForChat, 
      chatIndicatorItems, docsSearchEnabled, webSearchEnabled, saveClassState]);
  
  // Save state before ID changes
  useEffect(() => {
    if (previousClassIdRef.current && previousClassIdRef.current !== id) {
      // Save the PREVIOUS class state before switching
      const previousId = previousClassIdRef.current;
      const stateToSave = previousStateRef.current;
      
      saveClassState(previousId, stateToSave);
      
      // Clear the previousStateRef to prevent contamination
      previousStateRef.current = {};
    }
  }, [id, saveClassState]);
  
  // Track current state continuously
  useEffect(() => {
    previousStateRef.current = {
      selectedDocumentId: documentManager.selectedDocument?.id,
      currentPage: documentManager.currentPage,
      messages: chatManager.messages,
      streamingMessageIds: chatManager.streamingMessageIds,
      isFileManagerCollapsed,
      chatInputValue,
      selectedTextForChat,
      chatIndicatorItems,
      docsSearchEnabled,
      webSearchEnabled,
    };
  }, [documentManager.selectedDocument, documentManager.currentPage,
      chatManager.messages, chatManager.streamingMessageIds,
      isFileManagerCollapsed, chatInputValue, 
      selectedTextForChat, chatIndicatorItems, docsSearchEnabled, webSearchEnabled]);
  
  // Restore state when class ID changes
  useEffect(() => {
    if (id && id !== previousClassIdRef.current) {
      
      // Invalidate document URL queries to prevent cross-class contamination
      queryClient.invalidateQueries({ queryKey: ['presigned-url'] });
      
      const storedState = getClassState(id);
      
      if (storedState) {
        // Restore UI state
        setIsFileManagerCollapsed(storedState.isFileManagerCollapsed);
        setSelectedTextForChat(storedState.selectedTextForChat);
        setChatIndicatorItems(storedState.chatIndicatorItems);
        setChatInputValue(storedState.chatInputValue);
        setDocsSearchEnabled(storedState.docsSearchEnabled !== undefined ? storedState.docsSearchEnabled : true);
        setWebSearchEnabled(storedState.webSearchEnabled || false);
      } else {
        // Reset to defaults for new class
        setIsFileManagerCollapsed(false);
        setSelectedTextForChat('');
        setChatIndicatorItems([]);
        setChatInputValue('');
        setDocsSearchEnabled(true);
        setWebSearchEnabled(false);
      }
    }
    previousClassIdRef.current = id;
  }, [id, getClassState, documentManager, queryClient]);
  
  

  // Determine if we're in a loading state - be more permissive
  const isPageLoading = courseLoading && !displayCourse;

  // Error state
  if (courseError && !displayCourse) {
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-lg text-red-600 dark:text-red-400">
          Failed to load classes
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
          <div className="text-lg text-gray-600 dark:text-gray-400">Loading class...</div>
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

        {/* Create the chat container once */}
        {(() => {
          const chatContainer = (
            <MemoizedChatContainer
                key={`chat-interface-${id}`}
                messages={chatManager.messages}
                isAiLoading={chatManager.isAiLoading}
                onSubmit={handleCombinedSubmit}
                onClearChat={chatManager.handleClearChat}
                streamingMessageIds={chatManager.streamingMessageIds}
                onOpenInFile={handleOpenInFile}
                slides={allSlides}
                selectedTextForChat={selectedTextForChat}
                onClearSelectedText={clearSelectedText}
                courses={allCourses}
                isPdfPreviewOpen={!!documentManager.selectedDocument}
                indicatorItems={chatIndicatorItems}
                onIndicatorItemsChange={setChatIndicatorItems}
                documents={documentManager.documents}
                value={chatInputValue}
                onValueChange={setChatInputValue}
                onOpenDocument={(documentId: string) => {
                  const doc = documentManager.documents.find(d => d.id === documentId);
                  if (doc) {
                    documentManager.handlePreviewDocument(doc);
                  }
                }}
                onRemoveDocument={(documentId: string) => {
                  const doc = documentManager.documents.find(d => d.id === documentId);
                  if (doc) {
                    documentManager.handleDeleteDocumentDirect(doc);
                  }
                }}
                onRenameDocument={async (documentId: string, newName: string) => {
                  const doc = documentManager.documents.find(d => d.id === documentId);
                  if (!doc) return;
                  
                  // Get the file extension from the original name
                  const fileExtension = doc.name.split('.').pop() || '';
                  
                  // Add the extension to the new name
                  const fullNewName = fileExtension ? `${newName}.${fileExtension}` : newName;
                  
                  // Check for duplicate names first
                  const existingDoc = documentManager.documents.find(
                    d => d.id !== doc.id && d.name.toLowerCase() === fullNewName.toLowerCase()
                  );
                  
                  if (existingDoc) {
                    alert(`A file with the name "${fullNewName}" already exists`);
                    return;
                  }
                  
                  try {
                    // Directly call the API to rename
                    await slideApi.update(id!, doc.id, { originalFileName: fullNewName });
                    
                    // Refresh the documents list
                    queryClient.invalidateQueries({ queryKey: ['slides', id] });
                    
                    // Update selected document if it's the one being renamed
                    if (documentManager.selectedDocument?.id === doc.id) {
                      documentManager.setSelectedDocument({ 
                        ...documentManager.selectedDocument, 
                        name: fullNewName 
                      });
                    }
                  } catch (error: any) {
                    alert(error.message || 'Failed to rename document');
                  }
                }}
                onFilesUploaded={async (files: File[]) => {
                  // Check for files that already exist
                  const existingFileNames = documentManager.documents.map(doc => ({ 
                    name: doc.name.toLowerCase(), 
                    doc 
                  }));
                  
                  const filesToProcess = files.map(file => {
                    const existing = existingFileNames.find(item => item.name === file.name.toLowerCase());
                    return { file, existingDoc: existing?.doc };
                  });
                  
                  const newFiles = filesToProcess.filter(item => !item.existingDoc).map(item => item.file);
                  
                  // Upload only new files (without showing duplicate error)
                  if (newFiles.length > 0) {
                    await documentManager.handleFilesUploaded(newFiles);
                    
                    // Wait for the query to be invalidated and refetched
                    await queryClient.invalidateQueries({ queryKey: ['slides', id] });
                    
                    // Wait a bit more for the UI to update
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                  
                  // Re-fetch documents after upload
                  const updatedSlides = await slideApi.getAll(id!);
                  
                  // Add all files to priority list
                  for (const { file, existingDoc } of filesToProcess) {
                    let doc = existingDoc;
                    
                    // If it was a new file, find it in the updated slides
                    if (!doc && updatedSlides) {
                      const matchingSlide = updatedSlides.find(slide => 
                        slide.originalFileName.toLowerCase() === file.name.toLowerCase()
                      );
                      if (matchingSlide) {
                        doc = {
                          id: matchingSlide.id,
                          name: matchingSlide.originalFileName,
                          type: matchingSlide.contentType,
                          size: matchingSlide.fileSize,
                          uploadedAt: new Date(matchingSlide.uploadTimestamp)
                        };
                      }
                    }
                    
                    if (doc) {
                      // Check if not already in indicator items
                      const currentItems = chatIndicatorItems;
                      if (!currentItems.some(item => item.id === doc.id)) {
                        const newItem = {
                          id: doc.id,
                          type: 'document' as const,
                          name: doc.name,
                          removable: true
                        };
                        setChatIndicatorItems([...currentItems, newItem]);
                      }
                    }
                  }
                }}
                onSaveCurrentState={saveCurrentState}
                docsSearchEnabled={docsSearchEnabled}
                onDocsSearchEnabledChange={setDocsSearchEnabled}
                webSearchEnabled={webSearchEnabled}
                onWebSearchEnabledChange={setWebSearchEnabled}
            />
          );

          // Render based on whether document is selected AND belongs to current course
          if (documentManager.selectedDocument && id) {
            // Double-check that the selected document belongs to the current course
            const documentBelongsToCurrentCourse = allSlides.some(
              slide => slide.id === documentManager.selectedDocument?.id
            );
            
            if (documentBelongsToCurrentCourse) {
              return (
                <div style={{ display: 'flex', height: '100%', width: '100%' }}>
                  <DocumentPreview
                    document={documentManager.selectedDocument}
                    onClose={() => documentManager.setSelectedDocument(null)}
                    onSetSelectedTextForChat={setSelectedTextForChatHandler}
                    onPageChange={documentManager.handlePageChange}
                    initialPage={documentManager.currentPage}
                    courseId={id}
                  >
                    {chatContainer}
                  </DocumentPreview>
                </div>
              );
            }
          }
          
          // If no document or document doesn't belong to current course
          return (
              <div className="flex-1 h-full pr-2">
                {chatContainer}
              </div>
            );
        })()}
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
        initialName={documentManager.editInitialName}
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