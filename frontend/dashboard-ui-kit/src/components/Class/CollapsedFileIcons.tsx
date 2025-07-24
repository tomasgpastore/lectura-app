import React from 'react';
import { Plus } from 'lucide-react';
import { Document } from '../../types';

interface CollapsedFileIconsProps {
  documents: Document[];
  onPreviewDocument: (document: Document) => void;
  onFilesUploaded: (files: File[]) => void;
}

export const CollapsedFileIcons: React.FC<CollapsedFileIconsProps> = ({
  documents,
  onPreviewDocument,
  onFilesUploaded,
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesUploaded(files);
    }
  };

  return (
    <>
      {/* Add File Button - Always static */}
      <div className="mb-4">
        <input
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileChange}
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
      
      {/* File Icons */}
      <div className="flex flex-col space-y-2 flex-1 overflow-y-auto">
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
    </>
  );
}; 