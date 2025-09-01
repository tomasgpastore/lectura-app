import { useCallback } from 'react';

interface UseTextInputHandlerProps {
  setShowFiles: (show: boolean) => void;
  setFileFilter: (filter: string) => void;
  setSelectedFileIndex: (index: number) => void;
  setShowCommands: (show: boolean) => void;
  setCommandFilter: (filter: string) => void;
  setShowClassSuggestions: (show: boolean) => void;
  setClassFilter: (filter: string) => void;
  setSelectedClassIndex: (index: number) => void;
  setShowDocumentSuggestions: (show: boolean) => void;
  setDocumentFilter: (filter: string) => void;
  setSelectedDocumentIndex: (index: number) => void;
}

export const useTextInputHandler = ({
  setShowFiles,
  setFileFilter,
  setSelectedFileIndex,
  setShowCommands,
  setCommandFilter,
  setShowClassSuggestions,
  setClassFilter,
  setSelectedClassIndex,
  setShowDocumentSuggestions,
  setDocumentFilter,
  setSelectedDocumentIndex,
}: UseTextInputHandlerProps) => {
  const handleTextChange = useCallback((value: string, cursorPosition: number) => {
    const textBeforeCursor = value.substring(0, cursorPosition);
    
    // Check for @ mentions
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
    const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n');
    const lastBreakIndex = Math.max(lastSpaceIndex, lastNewlineIndex);
    
    if (lastAtIndex > lastBreakIndex && lastAtIndex !== -1) {
      // User is typing a file mention
      const filterText = textBeforeCursor.substring(lastAtIndex + 1);
      setShowFiles(true);
      setFileFilter(filterText);
      setSelectedFileIndex(0);
      setShowCommands(false);
      setCommandFilter('');
      setShowClassSuggestions(false);
    } else if (value.startsWith('/cd ') && value.length > 4) {
      // User is typing class name after /cd command
      const classFilterText = value.substring(4).trim();
      setShowClassSuggestions(true);
      setClassFilter(classFilterText);
      setSelectedClassIndex(0);
      setShowCommands(false);
      setShowFiles(false);
      setShowDocumentSuggestions(false);
    } else if (value.startsWith('/open ') && value.length > 6) {
      // User is typing document name after /open command
      const documentFilterText = value.substring(6).trim();
      setShowDocumentSuggestions(true);
      setDocumentFilter(documentFilterText);
      setSelectedDocumentIndex(0);
      setShowCommands(false);
      setShowFiles(false);
      setShowClassSuggestions(false);
    } else if (value.startsWith('/remove ') && value.length > 8) {
      // User is typing document name after /remove command
      const documentFilterText = value.substring(8).trim();
      setShowDocumentSuggestions(true);
      setDocumentFilter(documentFilterText);
      setSelectedDocumentIndex(0);
      setShowCommands(false);
      setShowFiles(false);
      setShowClassSuggestions(false);
    } else if (value.startsWith('/rename ') && value.length > 8) {
      // User is typing document name after /rename command
      const parts = value.substring(8).trim().split(' ');
      if (parts.length === 1 || (parts.length > 1 && !parts[1])) {
        // Still typing the first document name
        setShowDocumentSuggestions(true);
        setDocumentFilter(parts[0]);
        setSelectedDocumentIndex(0);
        setShowCommands(false);
        setShowFiles(false);
        setShowClassSuggestions(false);
      } else {
        // Already selected document, now typing new name - hide suggestions
        setShowDocumentSuggestions(false);
        setShowCommands(false);
        setShowFiles(false);
        setShowClassSuggestions(false);
      }
    } else if (value.startsWith('/')) {
      // Check if user is typing a command
      setShowCommands(true);
      setCommandFilter(value);
      setShowFiles(false);
      setFileFilter('');
      setShowClassSuggestions(false);
      setShowDocumentSuggestions(false);
    } else {
      setShowCommands(false);
      setCommandFilter('');
      setShowFiles(false);
      setFileFilter('');
      setShowClassSuggestions(false);
      setShowDocumentSuggestions(false);
    }
  }, [
    setShowFiles,
    setFileFilter,
    setSelectedFileIndex,
    setShowCommands,
    setCommandFilter,
    setShowClassSuggestions,
    setClassFilter,
    setSelectedClassIndex,
    setShowDocumentSuggestions,
    setDocumentFilter,
    setSelectedDocumentIndex,
  ]);

  return {
    handleTextChange,
  };
};