import React, { useState, useCallback } from 'react';
import { MoreVertical, Edit3, Trash2, Loader2 } from 'lucide-react';
import { Document } from '../../types';
import { formatFileSize } from '../../utils/class/documentUtils';

interface DocumentListProps {
  documents: Document[];
  isLoading?: boolean;
  onPreviewDocument: (document: Document) => void;
  onDeleteConfirmation: (document: Document) => void;
  onEditDocument?: (document: Document) => void;
}

export const DocumentList: React.FC<DocumentListProps> = React.memo(({
  documents,
  isLoading = false,
  onPreviewDocument,
  onDeleteConfirmation,
  onEditDocument,
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleDocumentClick = useCallback((doc: Document) => {
    if (doc.isLoading) return; // Don't allow clicking loading documents
    onPreviewDocument(doc);
  }, [onPreviewDocument]);

  const handleMenuToggle = useCallback((docId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent document click
    setOpenMenuId(openMenuId === docId ? null : docId);
  }, [openMenuId]);

  const handleEdit = useCallback((doc: Document, event: React.MouseEvent) => {
    event.stopPropagation();
    setOpenMenuId(null);
    onEditDocument?.(doc);
  }, [onEditDocument]);

  const handleDelete = useCallback((doc: Document, event: React.MouseEvent) => {
    event.stopPropagation();
    setOpenMenuId(null);
    onDeleteConfirmation(doc);
  }, [onDeleteConfirmation]);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-12 h-12 text-[#F97316] dark:text-[#F97316]/80 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading documents...
        </p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <img 
          src="/file-upload-500.png" 
          alt="Upload files" 
          className="w-12 h-12 mx-auto mb-3 dark:hidden" 
        />
        <img 
          src="/file-upload-400.png" 
          alt="Upload files" 
          className="w-12 h-12 mx-auto mb-3 hidden dark:block" 
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No documents uploaded yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          onClick={() => handleDocumentClick(doc)}
          className={`group rounded-xl p-4 transition-colors ${
            doc.isLoading 
              ? 'bg-gray-50 dark:bg-neutral-700 cursor-default' 
              : 'hover:bg-gray-50 dark:hover:bg-neutral-700 cursor-pointer'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-start space-x-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                {doc.isLoading ? (
                  <Loader2 className="w-5 h-5 text-[#F97316] dark:text-[#F97316]/80 animate-spin" />
                ) : (
                  <img src="/pdf-icon.png" alt="PDF" className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className={`text-sm font-medium truncate ${
                  doc.isLoading 
                    ? 'text-gray-500 dark:text-gray-400' 
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {doc.name}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {doc.isLoading ? (
                    'Uploading...'
                  ) : (
                    `${formatFileSize(doc.size)} • ${doc.uploadedAt.toLocaleDateString()}`
                  )}
                </p>
              </div>
            </div>
            
            {/* 3-dot menu - only show for non-loading documents */}
            {!doc.isLoading && (
              <div className="relative ml-4">
                <button
                  onClick={(e) => handleMenuToggle(doc.id, e)}
                  className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 rounded transition-all duration-200 ease-in-out"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4"/>
                </button>
                
                {/* Dropdown Menu */}
                {openMenuId === doc.id && (
                  <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700 py-1 z-10">
                    {onEditDocument && (
                      <button
                        onClick={(e) => handleEdit(doc, e)}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(doc, e)}
                      className="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}); 