import { Document } from '../../types';

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const createDocumentFromFile = (file: File): Document => {
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    uploadedAt: new Date(),
    content: file.type === 'text/plain' ? 'Sample document content for preview...' : undefined
  };
};

export const handleFilesUpload = (files: File[]): Document[] => {
  return files.map(createDocumentFromFile);
}; 