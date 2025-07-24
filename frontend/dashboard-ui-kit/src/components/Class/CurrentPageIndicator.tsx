import React from 'react';
import { Eye } from 'lucide-react';

interface CurrentPageIndicatorProps {
  isVisible: boolean;
  currentPage?: number;
}

export const CurrentPageIndicator: React.FC<CurrentPageIndicatorProps> = ({ isVisible, currentPage }) => {
  if (!isVisible) return null;

  return (
    <div className="transition-all duration-300 opacity-100 scale-1000 inline-block">
      <div className="relative">
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-md py-0.5 px-1 inline-block">
          <div className="flex items-center gap-1">
            <span className="text-xs text-orange-700 dark:text-orange-300 whitespace-nowrap">
              Current page
            </span>
            <Eye className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
      </div>
    </div>
  );
};