import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ChatMessageUI } from '../types';

// Define the state shape for each class
interface ClassState {
  // Document state
  selectedDocumentId?: string;
  currentPage?: number;
  
  // Chat state
  messages: ChatMessageUI[];
  chatScrollPosition?: number;
  streamingMessageIds: Set<string>;
  
  // UI state
  isFileManagerCollapsed: boolean;
  chatInputValue: string;
  selectedTextForChat: string;
  chatIndicatorItems: Array<{
    id: string;
    type: 'current-page' | 'document';
    name: string;
    removable: boolean;
  }>;
}

interface ClassStateContextType {
  // Get state for a specific class
  getClassState: (classId: string) => ClassState | undefined;
  
  // Save state for a specific class
  saveClassState: (classId: string, state: Partial<ClassState>) => void;
  
  // Clear state for a specific class
  clearClassState: (classId: string) => void;
  
  // Clear all states
  clearAllStates: () => void;
}

const ClassStateContext = createContext<ClassStateContextType | undefined>(undefined);

export const ClassStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Store states for all classes in a map
  const classStatesRef = useRef<Map<string, ClassState>>(new Map());
  const [, forceUpdate] = useState({});

  // Get state for a specific class
  const getClassState = useCallback((classId: string): ClassState | undefined => {
    return classStatesRef.current.get(classId);
  }, []);

  // Save state for a specific class
  const saveClassState = useCallback((classId: string, partialState: Partial<ClassState>) => {
    const currentState = classStatesRef.current.get(classId) || {
      messages: [],
      streamingMessageIds: new Set(),
      isFileManagerCollapsed: false,
      chatInputValue: '',
      selectedTextForChat: '',
      chatIndicatorItems: [],
    };
    
    // Merge the partial state with existing state
    const newState: ClassState = {
      ...currentState,
      ...partialState,
      // Special handling for Set since it doesn't spread properly
      streamingMessageIds: partialState.streamingMessageIds || currentState.streamingMessageIds,
    };
    
    classStatesRef.current.set(classId, newState);
    
    // Force re-render if needed
    forceUpdate({});
  }, []);

  // Clear state for a specific class
  const clearClassState = useCallback((classId: string) => {
    classStatesRef.current.delete(classId);
    forceUpdate({});
  }, []);

  // Clear all states
  const clearAllStates = useCallback(() => {
    classStatesRef.current.clear();
    forceUpdate({});
  }, []);

  const value = {
    getClassState,
    saveClassState,
    clearClassState,
    clearAllStates,
  };

  return (
    <ClassStateContext.Provider value={value}>
      {children}
    </ClassStateContext.Provider>
  );
};

export const useClassState = () => {
  const context = useContext(ClassStateContext);
  if (context === undefined) {
    throw new Error('useClassState must be used within a ClassStateProvider');
  }
  return context;
};