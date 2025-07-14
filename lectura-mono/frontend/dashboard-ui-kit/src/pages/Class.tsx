import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Layout/Header';
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

  // Fetch course data with stale time to prefer cached data
  const { data: course, isLoading: courseLoading, error: courseError } = useQuery({
    queryKey: ['course', id],
    queryFn: () => courseApi.getById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // Get cached course data for immediate display (especially for optimistic updates)
  const cachedCourse = queryClient.getQueryData(['course', id!]);

  // Use cached data if available, otherwise use fetched data
  const displayCourse = cachedCourse || course;

  // Fetch all slides for the course
  const { data: allSlides = [], isLoading: slidesLoading } = useQuery({
    queryKey: ['slides', id],
    queryFn: () => slideApi.getAll(id!),
    enabled: !!id && !!displayCourse
  });

  // Filter slides based on search query (local filtering for instant results)
  const filteredSlides = allSlides.filter(slide =>
    slide.originalFileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Custom hooks for functionality
  const documentManager = useDocumentManager(id, filteredSlides);
  const chatManager = useChatManager();
  const resizeManager = useResizeManager();

  // Show file management only when no document is previewed
  const showFileManagement = !documentManager.selectedDocument;

  // Loading state (only show if no cached data)
  if ((courseLoading && !cachedCourse) || (!displayCourse)) {
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading course...</div>
      </div>
    );
  }

  // Error state
  if (courseError && !cachedCourse) {
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-lg text-red-600 dark:text-red-400">
          Failed to load course
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen bg-blue-50 dark:bg-neutral-900 flex flex-col ${resizeManager.isResizing ? 'cursor-col-resize' : ''}`}>
      <Header 
        courseName={(displayCourse as any).name}
        courseCode={(displayCourse as any).code}
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
        <div className="flex-1 p-2 mr-2 h-full" style={{ width: documentManager.selectedDocument ? `${100 - resizeManager.previewWidth}%` : '100%' }}>
          <ChatInterface
            messages={chatManager.messages}
            isAiLoading={chatManager.isAiLoading}
            inputMessage={chatManager.inputMessage}
            onInputChange={chatManager.handleInputChange}
            onSubmit={chatManager.handleSubmit}
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