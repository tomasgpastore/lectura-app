import React, { useState, useMemo } from 'react';
import { ChevronsLeft, ChevronsRight, Search, Plus } from 'lucide-react';
import { Document } from '../../types';
import { FileUploadArea } from './FileUploadArea';
import { DocumentList } from './DocumentList';
import { CollapsedFileIcons } from './CollapsedFileIcons';

interface FileManagerProps {
  documents: Document[];
  isLoading?: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onFilesUploaded: (files: File[]) => void;
  onPreviewDocument: (document: Document) => void;
  onDeleteConfirmation: (document: Document) => void;
  onEditDocument?: (document: Document) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const FileManager: React.FC<FileManagerProps> = ({
  documents,
  isLoading = false,
  isCollapsed,
  onToggleCollapse,
  onFilesUploaded,
  onPreviewDocument,
  onDeleteConfirmation,
  onEditDocument,
  searchQuery: externalSearchQuery = '',
  onSearchChange: externalOnSearchChange,
}) => {
  // Internal search state - this won't cause parent re-renders
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  
  // Use external search if provided, otherwise use internal
  const searchQuery = externalSearchQuery || internalSearchQuery;
  const onSearchChange = externalOnSearchChange || setInternalSearchQuery;
  
  // Filter documents based on search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    return documents.filter(doc =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);
  return (
    <div className={`${isCollapsed ? 'w-39' : 'w-96'} pr-2 pl-2 transition-all duration-200 ease-out will-change-transform`}>
      <div className="bg-white dark:bg-neutral-800 rounded-xl flex flex-col h-full">
        {!isCollapsed ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Documents</h3>
              <button
                onClick={onToggleCollapse}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Collapse sidebar"
              >
                <ChevronsLeft className="w-5 h-5" />
              </button>
            </div>

            {/* File Upload Section */}
            <div className="px-3">
              <div className="mb-4">
              </div>
              <FileUploadArea onFilesUploaded={onFilesUploaded} />
            </div>
            
            {/* Divider */}
            <div className="mx-6"></div>

            {/* File List Header - Fixed */}
            <div className="px-3 pt-4 pb-2">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {isLoading ? 'Loading...' : `${filteredDocuments.length} of ${documents.length} files`}
                </span>
              </div>
              
              {/* Search Bar */}
              <div className="relative mb-2">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search documents..."
                  className="block w-full pl-10 pr-3 py-2 rounded-lg text-sm placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent shadow-[0_0_15px_rgba(0,0,0,0.2)] dark:shadow-none"
                />
              </div>
            </div>

            {/* File List - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="pt-4">
                <DocumentList
                  documents={filteredDocuments}
                  isLoading={isLoading}
                  onPreviewDocument={onPreviewDocument}
                  onDeleteConfirmation={onDeleteConfirmation}
                  onEditDocument={onEditDocument}
                />
              </div>
            </div>
          </>
        ) : (
          /* Collapsed Sidebar */
          <>
            {/* Header */}
            <div className="flex items-center justify-center px-4 py-2 flex-shrink-0">
              <button
                onClick={onToggleCollapse}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Expand sidebar"
              >
                <ChevronsRight className="w-5 h-5" />
              </button>
            </div>
            
            {/* Add File Button - Fixed */}
            <div className="p-2 pt-6 flex justify-center">
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    onFilesUploaded(files);
                  }
                }}
                className="hidden"
                id="file-upload-collapsed"
              />
              <label 
                htmlFor="file-upload-collapsed"
                className="group cursor-pointer inline-block p-2 bg-gradient-to-r from-[#F97316] to-[#EF4444] hover:from-[#F97316]/90 hover:to-[#EF4444]/90 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                title="Add file"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              </label>
            </div>

            {/* Document Icons - Scrollable */}
            <div className="flex-1 overflow-y-auto p-2">
              <div className="flex flex-col items-center space-y-2">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => onPreviewDocument(doc)}
                    className={`p-2 rounded-lg transition-all duration-200 group ${
                      doc.isLoading 
                        ? 'cursor-default' 
                        : 'hover:bg-gray-100 dark:hover:bg-neutral-700 hover:scale-105'
                    }`}
                    title={doc.name}
                    disabled={doc.isLoading}
                  >
                    <img 
                      src="/pdf-icon.png" 
                      alt="PDF" 
                      className={`w-5 h-5 ${doc.isLoading ? 'animate-pulse opacity-50' : ''}`} 
                    />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}; 