import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface DeleteErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage: string;
}

export const DeleteErrorModal: React.FC<DeleteErrorModalProps> = ({
  isOpen,
  onClose,
  errorMessage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-25 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl p-8 w-full max-w-md transform transition-all">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {errorMessage}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#F97316] to-[#EF4444] hover:from-[#F97316]/90 hover:to-[#EF4444]/90 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}; 