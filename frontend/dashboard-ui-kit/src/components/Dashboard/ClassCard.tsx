import React, { useState, useRef, useEffect } from 'react';
import { Book, FileText, MoreVertical, Edit3, Trash2 } from 'lucide-react';
import { Course } from '../../types';

interface ClassCardProps {
  classData: Course;
  onClick: () => void;
  onEdit: (classData: Course) => void;
  onRemove: (classData: Course) => void;
}

export const ClassCard: React.FC<ClassCardProps> = ({ classData, onClick, onEdit, onRemove }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(false);
    onEdit(classData);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(false);
    onRemove(classData);
  };

  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-lg border border-gray-200 dark:border-gray-700 cursor-pointer transition-all duration-200 hover:scale-105 relative"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
          <Book className="w-6 h-6 text-orange-600 dark:text-orange-400" />
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {classData.code}
          </span>
          
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleMoreClick}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showDropdown && (
              <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-700 py-1 z-10">
                <button
                  onClick={handleEdit}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit
                </button>
                <button
                  onClick={handleRemove}
                  className="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
        {classData.name}
      </h3>
      
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-1">
          <FileText className="w-4 h-4" />
          <span>{classData.slideId.length} documents</span>
        </div>
      </div>
    </div>
  );
}; 