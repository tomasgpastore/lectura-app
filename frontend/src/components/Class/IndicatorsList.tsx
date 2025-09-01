import React from 'react';
import { X, Eye } from 'lucide-react';

export interface IndicatorItem {
  id: string;
  type: 'current-page' | 'document';
  name: string;
  removable: boolean;
}

interface IndicatorsListProps {
  items: IndicatorItem[];
  onRemoveItem: (itemId: string) => void;
}

export const IndicatorsList: React.FC<IndicatorsListProps> = ({ 
  items, 
  onRemoveItem 
}) => {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <div key={item.id} className="transition-all duration-300 opacity-100 scale-1000 inline-block">
          <div className="relative">
            <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-md py-0.5 px-1 inline-block">
              <div className="flex items-center gap-1">
                <span className="text-xs text-orange-700 dark:text-orange-300 whitespace-nowrap">
                  {item.name}
                </span>
                {item.type === 'current-page' && (
                  <Eye className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                )}
                {item.removable && (
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="ml-1 p-0.5 hover:bg-orange-200 dark:hover:bg-orange-800 rounded transition-colors"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};