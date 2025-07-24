import { useState, useCallback, useEffect, useRef } from 'react';

const COMMAND_HISTORY_KEY = 'lectura_command_history';
const MAX_HISTORY_SIZE = 10;

export const useCommandHistory = () => {
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const currentCommandRef = useRef<string>('');

  // Load command history from localStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(COMMAND_HISTORY_KEY);
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory);
        if (Array.isArray(parsed)) {
          // Ensure we have an array of strings
          const validHistory = parsed.filter(item => typeof item === 'string').slice(0, MAX_HISTORY_SIZE);
          setCommandHistory(validHistory);
        }
      }
    } catch (error) {
      console.error('Failed to load command history:', error);
      // Initialize with empty array if loading fails
      setCommandHistory([]);
    }
  }, []);

  // Add a command to history
  const addToHistory = useCallback((command: string) => {
    if (!command.trim() || !command.startsWith('/')) return;

    console.log('Adding command to history:', command);

    // Get current history from state
    const currentHistory = commandHistory;
    
    // Create new history with the command at the beginning
    let newHistory = [command];
    
    // Add previous commands, excluding duplicates of the current command
    for (const cmd of currentHistory) {
      if (cmd !== command && newHistory.length < MAX_HISTORY_SIZE) {
        newHistory.push(cmd);
      }
    }
    
    // Ensure we don't exceed max size
    newHistory = newHistory.slice(0, MAX_HISTORY_SIZE);
    
    // Save to localStorage immediately (synchronously)
    try {
      localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(newHistory));
      console.log('Saved to localStorage:', newHistory);
    } catch (error) {
      console.error('Failed to save command history:', error);
    }
    
    // Update state
    setCommandHistory(newHistory);
    
    // Reset history index when a new command is added
    setHistoryIndex(-1);
    currentCommandRef.current = '';
  }, [commandHistory]);

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