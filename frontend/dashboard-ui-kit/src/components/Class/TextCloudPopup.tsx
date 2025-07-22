import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface TextCloudPopupProps {
  text: string;
  isVisible: boolean;
  onClose: () => void;
}

export const TextCloudPopup: React.FC<TextCloudPopupProps> = ({ text, isVisible, onClose }) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else {
      // Delay unmounting to allow exit animation
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!shouldRender) return null;

  // Inline version for chat input area
  return (
    <div 
      className={`transition-all duration-300 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      <div className="relative">
        {/* Inline cloud bubble - rounded top corners with perfect nesting */}
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 py-1.5 px-1.5" style={{ borderTopLeftRadius: '6px', borderTopRightRadius: '6px'}}>
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
};