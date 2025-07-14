import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Course } from '../../types';

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditClass: (classData: { name: string; code: string }) => void;
  classData: Course | null;
}

export const EditClassModal: React.FC<EditClassModalProps> = ({
  isOpen,
  onClose,
  onEditClass,
  classData,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (classData) {
      setName(classData.name);
      setCode(classData.code);
    }
  }, [classData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && code.trim()) {
      onEditClass({ name: name.trim(), code: code.trim().toUpperCase() });
      onClose();
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form when closing
    if (classData) {
      setName(classData.name);
      setCode(classData.code);
    }
  };

  if (!isOpen || !classData) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-25 transition-opacity" onClick={handleClose} />
        
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl p-8 w-full max-w-md transform transition-all">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Class</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Update your course details</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="edit-class-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Course Name
              </label>
              <input
                id="edit-class-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors duration-200"
                placeholder="e.g., Introduction to Psychology"
              />
            </div>

            <div>
              <label htmlFor="edit-class-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Course Code
              </label>
              <input
                id="edit-class-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors duration-200"
                placeholder="e.g., PSY101"
                maxLength={10}
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}; 