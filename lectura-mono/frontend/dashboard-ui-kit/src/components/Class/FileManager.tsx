import React from 'react';
import { ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { Document } from '../../types';
import { FileUploadArea } from './FileUploadArea';
import { DocumentList } from './DocumentList';
import { CollapsedFileIcons } from './CollapsedFileIcons';

interface FileManagerProps {
  documents: Document[];
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
  isCollapsed,
  onToggleCollapse,
  onFilesUploaded,
  onPreviewDocument,
  onDeleteConfirmation,
  onEditDocument,
  searchQuery = '',
  onSearchChange,
}) => {
  return (
    <div className={`${isCollapsed ? 'w-39' : 'w-96'} p-2 transition-all duration-300`}>
      <div className="bg-white dark:bg-neutral-800 dark:border-neutral-700 rounded-xl border flex flex-col h-full">
        {!isCollapsed ? (
          <>
            {/* File Upload Section */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Upload Documents
                </h3>
                <button
                  onClick={onToggleCollapse}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Collapse sidebar"
                >
                  <ChevronsLeft className="w-5 h-5" />
                </button>
              </div>
              <FileUploadArea onFilesUploaded={onFilesUploaded} />
            </div>
            
            {/* Divider */}
            <div className="mx-6 border-b border-gray-200 dark:border-neutral-700"></div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Documents
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {documents.length} files
                  </span>
                </div>
                
                {/* Search Bar */}
                {onSearchChange && (
                  <div className="relative mb-4">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      placeholder="Search documents..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-neutral-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                )}
                
                <DocumentList
                  documents={documents}
                  onPreviewDocument={onPreviewDocument}
                  onDeleteConfirmation={onDeleteConfirmation}
                  onEditDocument={onEditDocument}
                />
              </div>
            </div>
          </>
        ) : (
          /* Collapsed Sidebar */
          <div className="p-2 flex flex-col items-center h-full">
            {/* Expand Button */}
            <button
              onClick={onToggleCollapse}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-4"
              title="Expand sidebar"
            >
              <ChevronsRight className="w-5 h-5" />
            </button>
            
            <CollapsedFileIcons
              documents={documents}
              onPreviewDocument={onPreviewDocument}
              onFilesUploaded={onFilesUploaded}
            />
          </div>
        )}
      </div>
    </div>
  );
}; 