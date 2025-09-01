import { useState, useCallback, useRef } from 'react';
import { useClassStateStore } from '../../../stores/classStateStore';

export const useCommandHistory = () => {
  const { commandHistory, addCommandToHistory } = useClassStateStore();
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const currentCommandRef = useRef<string>('');

  // Add a command to history
  const addToHistory = useCallback((command: string) => {
    if (!command.trim() || !command.startsWith('/')) return;

    console.log('Adding command to history:', command);
    
    // Add to Zustand store
    addCommandToHistory(command);
    console.log('Saved to Zustand:', commandHistory);
    
    // Reset history index when a new command is added
    setHistoryIndex(-1);
    currentCommandRef.current = '';
  }, [addCommandToHistory, commandHistory]);

  // Navigate through history
  const navigateHistory = useCallback((direction: 'up' | 'down', currentValue: string = '') => {
    if (commandHistory.length === 0) return null;

    // Save current command if we're starting to navigate
    if (historyIndex === -1 && currentValue) {
      currentCommandRef.current = currentValue;
    }

    let newIndex = historyIndex;
    
    if (direction === 'up') {
      // Go to older commands (increase index)
      if (historyIndex < commandHistory.length - 1) {
        newIndex = historyIndex + 1;
      }
    } else {
      // Go to newer commands (decrease index)
      if (historyIndex > -1) {
        newIndex = historyIndex - 1;
      }
    }

    setHistoryIndex(newIndex);
    
    // Return the appropriate command
    if (newIndex === -1) {
      // Back to the current command
      return currentCommandRef.current;
    } else {
      // Return command from history
      return commandHistory[newIndex];
    }
  }, [commandHistory, historyIndex]);

  // Reset history navigation
  const resetHistoryNavigation = useCallback(() => {
    setHistoryIndex(-1);
    currentCommandRef.current = '';
  }, []);

  // Debug function to show current state
  const debugHistory = useCallback(() => {
    console.log('Command History:', commandHistory);
    console.log('Current Index:', historyIndex);
    console.log('Current Command:', currentCommandRef.current);
  }, [commandHistory, historyIndex]);

  return {
    commandHistory,
    addToHistory,
    navigateHistory,
    resetHistoryNavigation,
    currentHistoryIndex: historyIndex,
    debugHistory,
  };
};