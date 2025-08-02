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

/**
 * Calculate upload progress based on file size and elapsed time
 * - 95% of the upload progresses at 760KB/s
 * - Last 5% progresses at 1% of the original speed (7.6KB/s)
 */
export const calculateUploadProgress = (fileSize: number, elapsedTimeMs: number): number => {
  const NORMAL_SPEED_KB_PER_SEC = 760; // 760 KB/s for 0-95%
  const SLOW_SPEED_KB_PER_SEC = 7.6; // 1% of normal speed for 95-100%
  const THRESHOLD_PERCENTAGE = 95;
  
  const elapsedSeconds = elapsedTimeMs / 1000;
  const fileSizeKB = fileSize / 1024;
  
  // Calculate how many KB would be uploaded at normal speed
  const uploadedAtNormalSpeed = elapsedSeconds * NORMAL_SPEED_KB_PER_SEC;
  
  // Calculate the KB threshold for 95%
  const threshold95KB = (fileSizeKB * THRESHOLD_PERCENTAGE) / 100;
  
  if (uploadedAtNormalSpeed <= threshold95KB) {
    // Still in the fast phase (0-95%)
    const progress = (uploadedAtNormalSpeed / fileSizeKB) * 100;
    return Math.min(progress, THRESHOLD_PERCENTAGE);
  } else {
    // In the slow phase (95-100%)
    const timeInFastPhase = threshold95KB / NORMAL_SPEED_KB_PER_SEC;
    const timeInSlowPhase = elapsedSeconds - timeInFastPhase;
    const uploadedInSlowPhase = timeInSlowPhase * SLOW_SPEED_KB_PER_SEC;
    const remainingKB = fileSizeKB - threshold95KB;
    const slowPhaseProgress = (uploadedInSlowPhase / remainingKB) * 5; // 5% range
    
    return Math.min(THRESHOLD_PERCENTAGE + slowPhaseProgress, 100);
  }
}; 