import React from 'react';
import ReactDOM from 'react-dom';
import { FileText } from 'lucide-react';
import { ChatSource } from '../../types';

interface RagSourceModalProps {
  source: ChatSource | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
  slides?: Array<{ id: string; originalFileName: string }>;
}

export const RagSourceModal: React.FC<RagSourceModalProps> = ({ 
  source, 
  isOpen, 
  onClose, 
  onOpenInFile, 
  slides = [] 
}) => {
  if (!isOpen || !source || source.type === 'web') return null;

  // Find the corresponding slide to get the original filename
  const slide = slides.find(s => s.id === source.slide);
  const fileName = slide?.originalFileName || "Not Found";

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Document Source
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="px-6 pb-6 overflow-y-auto">
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">File:</span>
                <p className="mt-1 text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  {fileName}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Pages:</span>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {source.start === source.end ? source.start : `${source.start}-${source.end}`}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Content:</span>
                <div className="mt-2 text-gray-900 dark:text-white p-4 rounded-lg max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                  {source.text}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button
                onClick={() => {
                  if (onOpenInFile) {
                    onOpenInFile(source.s3file, parseInt(source.start), source.text);
                    onClose();
                  }
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                Open in file
                <FileText className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render the modal using React Portal to ensure it's outside the chat scroll container
  return ReactDOM.createPortal(
    modalContent,
    document.body
  );
};