import React, { useState } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadAreaProps {
  onFilesUploaded: (files: File[]) => void;
}

export const FileUploadArea: React.FC<FileUploadAreaProps> = ({ onFilesUploaded }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesUploaded(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const allowedTypes = ['.pdf'];
    
    const validFiles = files.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return allowedTypes.includes(extension);
    });

    if (validFiles.length > 0) {
      onFilesUploaded(validFiles);
    }
  };

  return (
    <div 
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer group ${
        isDragOver 
          ? 'border-[#F97316] dark:border-[#F97316]/80 bg-[#F97316]/10 dark:bg-[#F97316]/20' 
          : 'border-gray-300 dark:border-gray-600 hover:border-[#F97316] dark:hover:border-[#F97316]/80'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple
        accept=".pdf"
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <Upload className={`w-8 h-8 mx-auto mb-2 transition-colors ${
          isDragOver 
            ? 'text-[#F97316] dark:text-[#F97316]/80' 
            : 'text-gray-400 group-hover:text-[#F97316]'
        }`} />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isDragOver ? 'Drop files here' : 'Click to upload or drag and drop'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          PDF • Max 10MB per file
        </p>
      </label>
    </div>
  );
}; 