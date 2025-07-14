import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Course } from '../../types';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateClass: (classData: Omit<Course, 'id' | 'slideId'>) => void;
}

export const CreateClassModal: React.FC<CreateClassModalProps> = ({
  isOpen,
  onClose,
  onCreateClass,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && code.trim()) {
      onCreateClass({ name: name.trim(), code: code.trim().toUpperCase() });
      setName('');
      setCode('');
      onClose();
    }
  };

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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Class</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Set up your course class</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="class-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Course Name
              </label>
              <input
                id="class-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors duration-200"
                placeholder="e.g., Introduction to Psychology"
              />
            </div>

            <div>
              <label htmlFor="class-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Course Code
              </label>
              <input
                id="class-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors duration-200"
                placeholder="e.g., PSY101"
                maxLength={10}
              />
            </div>

            <button
              type="submit"
              className="w-full flex justify-center items-center py-3 px-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Create Class
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}; 