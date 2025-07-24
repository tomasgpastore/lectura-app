import { useCallback } from 'react';
import { CommandWithParameter } from './commandDefinitions';
import { Course } from '../../../types';

interface File {
  id: string;
  name: string;
  type: string;
}

interface Document {
  id: string;
  name: string;
}

interface UseKeyboardNavigationProps {
  // File suggestions
  showFiles: boolean;
  filteredFiles: File[];
  selectedFileIndex: number;
  setSelectedFileIndex: (index: number | ((prev: number) => number)) => void;
  selectFile: (file: File) => void;
  setShowFiles: (show: boolean) => void;
  setFileFilter: (filter: string) => void;
  
  // Command suggestions
  showCommands: boolean;
  filteredCommands: CommandWithParameter[];
  selectedCommandIndex: number;
  setSelectedCommandIndex: (index: number | ((prev: number) => number)) => void;
  selectCommand: (command: CommandWithParameter) => void;
  setShowCommands: (show: boolean) => void;
  setCommandFilter: (filter: string) => void;
  setInternalValue: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  
  // Class suggestions
  showClassSuggestions: boolean;
  filteredCourses: Course[];
  selectedClassIndex: number;
  setSelectedClassIndex: (index: number | ((prev: number) => number)) => void;
  selectClass: (course: Course) => void;
  setShowClassSuggestions: (show: boolean) => void;
  setClassFilter: (filter: string) => void;
  
  // Document suggestions
  showDocumentSuggestions: boolean;
  filteredDocuments: Document[];
  selectedDocumentIndex: number;
  setSelectedDocumentIndex: (index: number | ((prev: number) => number)) => void;
  selectDocument: (document: Document) => void;
  setShowDocumentSuggestions: (show: boolean) => void;
  setDocumentFilter: (filter: string) => void;
}

export const useKeyboardNavigation = ({
  showFiles,
  filteredFiles,
  selectedFileIndex,
  setSelectedFileIndex,
  selectFile,
  setShowFiles,
  setFileFilter,
  showCommands,
  filteredCommands,
  selectedCommandIndex,
  setSelectedCommandIndex,
  selectCommand,
  setShowCommands,
  setCommandFilter,
  setInternalValue,
  textareaRef,
  showClassSuggestions,
  filteredCourses,
  selectedClassIndex,
  setSelectedClassIndex,
  selectClass,
  setShowClassSuggestions,
  setClassFilter,
  showDocumentSuggestions,
  filteredDocuments,
  selectedDocumentIndex,
  setSelectedDocumentIndex,
  selectDocument,
  setShowDocumentSuggestions,
  setDocumentFilter,
}: UseKeyboardNavigationProps) => {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle file suggestions navigation
    if (showFiles && filteredFiles.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedFileIndex((prev) => (prev + 1) % filteredFiles.length);
          return true;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedFileIndex((prev) => (prev - 1 + filteredFiles.length) % filteredFiles.length);
          return true;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          const selectedFile = filteredFiles[selectedFileIndex];
          if (selectedFile) {
            selectFile(selectedFile);
          }
          return true;
        case 'Escape':
          e.preventDefault();
          setShowFiles(false);
          setFileFilter('');
          return true;
      }
    }
    
    // Handle command suggestions navigation
    if (showCommands && filteredCommands.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedCommandIndex((prev) => (prev + 1) % filteredCommands.length);
          return true;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedCommandIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
          return true;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          const selectedCommand = filteredCommands[selectedCommandIndex];
          if (selectedCommand) {
            selectCommand(selectedCommand);
          }
          return true;
        case 'Escape':
          e.preventDefault();
          setShowCommands(false);
          setCommandFilter('');
          return true;
      }
    }
    
    // Handle class suggestions navigation
    if (showClassSuggestions && filteredCourses.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedClassIndex((prev) => (prev + 1) % filteredCourses.length);
          return true;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedClassIndex((prev) => (prev - 1 + filteredCourses.length) % filteredCourses.length);
          return true;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          const selectedCourse = filteredCourses[selectedClassIndex];
          if (selectedCourse) {
            selectClass(selectedCourse);
          }
          return true;
        case 'Escape':
          e.preventDefault();
          setShowClassSuggestions(false);
          setClassFilter('');
          return true;
      }
    }
    
    // Handle document suggestions navigation
    if (showDocumentSuggestions && filteredDocuments.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedDocumentIndex((prev) => (prev + 1) % filteredDocuments.length);
          return true;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedDocumentIndex((prev) => (prev - 1 + filteredDocuments.length) % filteredDocuments.length);
          return true;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          const selectedDocument = filteredDocuments[selectedDocumentIndex];
          if (selectedDocument) {
            selectDocument(selectedDocument);
          }
          return true;
        case 'Escape':
          e.preventDefault();
          setShowDocumentSuggestions(false);
          setDocumentFilter('');
          return true;
      }
    }
    
    return false; // Event not handled
  }, [
    showFiles,
    filteredFiles,
    selectedFileIndex,
    setSelectedFileIndex,
    selectFile,
    setShowFiles,
    setFileFilter,
    showCommands,
    filteredCommands,
    selectedCommandIndex,
    setSelectedCommandIndex,
    selectCommand,
    setShowCommands,
    setCommandFilter,
    setInternalValue,
    textareaRef,
    showClassSuggestions,
    filteredCourses,
    selectedClassIndex,
    setSelectedClassIndex,
    selectClass,
    setShowClassSuggestions,
    setClassFilter,
    showDocumentSuggestions,
    filteredDocuments,
    selectedDocumentIndex,
    setSelectedDocumentIndex,
    selectDocument,
    setShowDocumentSuggestions,
    setDocumentFilter,
  ]);

  return {
    handleKeyDown,
  };
};