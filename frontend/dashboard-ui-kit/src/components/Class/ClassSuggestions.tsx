import React, { useEffect, useRef } from 'react';
import { Course } from '../../types';

interface ClassSuggestionsProps {
  courses: Course[];
  selectedIndex: number;
  onSelectClass: (course: Course) => void;
}

export const ClassSuggestions: React.FC<ClassSuggestionsProps> = ({
  courses,
  selectedIndex,
  onSelectClass,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      const container = containerRef.current;
      const selected = selectedRef.current;
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();

      // Scroll if selected item is above viewport
      if (selectedRect.top < containerRect.top) {
        selected.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      // Scroll if selected item is below viewport
      else if (selectedRect.bottom > containerRect.bottom) {
        selected.scrollIntoView({ block: 'end', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (courses.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
      <div ref={containerRef} className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-hidden mx-1.5 max-h-60 overflow-y-auto">
        <div className="py-1">
          {courses.map((course, index) => (
            <button
              key={course.id}
              ref={index === selectedIndex ? selectedRef : null}
              onClick={() => onSelectClass(course)}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${
                index === selectedIndex
                  ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                  : 'hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <img 
                src={course.slideId.length > 0 ? "/folder-icon.png" : "/folder-empty-icon.png"} 
                alt={course.slideId.length > 0 ? "Folder with files" : "Empty folder"} 
                className="w-4 h-4 flex-shrink-0" 
              />
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{course.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{course.code}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};