import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Document } from '../../types';

interface EditDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateDocument: (updates: { name: string }) => Promise<void>;
  document: Document | null;
  initialName?: string;
}

export const EditDocumentModal: React.FC<EditDocumentModalProps> = ({
  isOpen,
  onClose,
  onUpdateDocument,
  document,
  initialName,
}) => {
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or document changes
  useEffect(() => {
    if (isOpen && document) {
      if (initialName) {
        // Use the provided initial name, remove extension if present
        const nameWithoutExt = initialName.split('.').slice(0, -1).join('.');
        setNewName(nameWithoutExt || initialName);
      } else {
        // Remove file extension from name for editing
        const nameWithoutExt = document.name.split('.').slice(0, -1).join('.');
        setNewName(nameWithoutExt || document.name);
      }
      setError(null); // Clear any previous errors
    } else {
      setNewName('');
      setError(null);
    }
  }, [isOpen, document, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newName.trim() || !document) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Add back the file extension
      const fileExtension = document.name.split('.').pop() || '';
      const fullName = fileExtension ? `${newName.trim()}.${fileExtension}` : newName.trim();
      
      await onUpdateDocument({ name: fullName });
      onClose();
    } catch (error: any) {
      console.error('Failed to update document:', error);
      setError(error.message || 'Failed to update document');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      // Reset form when closing
      if (document) {
        const nameWithoutExt = document.name.split('.').slice(0, -1).join('.');
        setNewName(nameWithoutExt || document.name);
      }
    }
  };

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-25 transition-opacity" onClick={handleClose} />
        
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl p-8 w-full max-w-md transform transition-all">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Document</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Update your document name</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="documentName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Document Name
              </label>
              <input
                id="documentName"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter document name"
                disabled={isSubmitting}
                className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors duration-200 disabled:opacity-50"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                File extension will be preserved automatically
              </p>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  {error}
                </p>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newName.trim()}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#F97316] to-[#EF4444] hover:from-[#F97316]/90 hover:to-[#EF4444]/90 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}; 