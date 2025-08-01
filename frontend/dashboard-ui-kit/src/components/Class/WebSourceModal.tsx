import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ChatSource } from '../../types';

interface WebSourceModalProps {
  source: ChatSource | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WebSourceModal: React.FC<WebSourceModalProps> = ({ source, isOpen, onClose }) => {
  if (!isOpen || !source || source.type !== 'web') return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Web Source
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
        
        <div className="p-6 overflow-y-auto">
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Title:</span>
                <p className="mt-1 text-gray-900 dark:text-white">{source.title}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">URL:</span>
                <a 
                  href={source.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-1 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 flex items-center gap-1"
                >
                  {source.url}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Content:</span>
                <div className="mt-2 text-gray-900 dark:text-white bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                  {source.text}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-neutral-700">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                Open in browser
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};