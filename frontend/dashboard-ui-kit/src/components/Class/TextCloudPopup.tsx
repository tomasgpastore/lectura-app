import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface TextCloudPopupProps {
  text: string;
  isVisible: boolean;
  onClose: () => void;
  inline?: boolean; // New prop for inline display within chat
}

export const TextCloudPopup: React.FC<TextCloudPopupProps> = ({ text, isVisible, onClose, inline = false }) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      // Auto-close after 5 seconds (only for floating version, not inline)
      if (!inline) {
        const timer = setTimeout(() => {
          onClose();
        }, 5000);
        return () => clearTimeout(timer);
      }
    } else {
      // Delay unmounting to allow exit animation
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, inline]);

  if (!shouldRender) return null;

  if (inline) {
    // Inline version for chat input area
    return (
      <div 
        className={`transition-all duration-300 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="relative">
          {/* Inline cloud bubble - rounded top corners matching chat input */}
          <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-t-xl p-3 pr-8">
            <div 
              className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed italic overflow-hidden"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.5rem',
                maxHeight: '4.5rem' // 3 lines * 1.5rem line-height
              }}
            >
              "{text}"
            </div>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-1 text-orange-400 hover:text-orange-600 dark:text-orange-500 dark:hover:text-orange-300 rounded-full hover:bg-orange-100 dark:hover:bg-orange-800/50 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Original floating version
  return (
    <div 
      className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      <div className="relative">
        {/* Cloud bubble */}
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-2xl shadow-lg p-4 pr-8 max-w-md mx-auto">
          <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
            "{text}"
          </div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        
        {/* Speech bubble tail */}
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
          <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-neutral-800"></div>
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
            <div className="w-0 h-0 border-l-7 border-r-7 border-t-7 border-l-transparent border-r-transparent border-t-gray-200 dark:border-t-neutral-600"></div>
          </div>
        </div>
      </div>
    </div>
  );
};