import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessageUI } from '../types';

// Define the state shape for each class
export interface ClassState {
  // Document state
  selectedDocumentId?: string;
  currentPage?: number;
  
  // Chat state
  messages: ChatMessageUI[];
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

interface ClassStateStore {
  // Map of classId to its state
  classStates: Map<string, ClassState>;
  
  // Command history (shared across all classes)
  commandHistory: string[];
  
  // Get state for a specific class
  getClassState: (classId: string) => ClassState | undefined;
  
  // Save state for a specific class
  saveClassState: (classId: string, state: Partial<ClassState>) => void;
  
  // Clear state for a specific class
  clearClassState: (classId: string) => void;
  
  // Clear all states
  clearAllStates: () => void;
  
  // Command history methods
  addCommandToHistory: (command: string) => void;
  getCommandHistory: () => string[];
}

// Create the default state for a new class
const createDefaultClassState = (): ClassState => ({
  messages: [],
  streamingMessageIds: new Set(),
  isFileManagerCollapsed: false,
  chatInputValue: '',
  selectedTextForChat: '',
  chatIndicatorItems: [],
});

const MAX_COMMAND_HISTORY = 10;

export const useClassStateStore = create<ClassStateStore>()(
  persist(
    (set, get) => ({
  classStates: new Map(),
  commandHistory: [],
  
  getClassState: (classId: string) => {
    const state = get().classStates.get(classId);
    return state;
  },
  
  saveClassState: (classId: string, partialState: Partial<ClassState>) => {
    set((state) => {
      const newClassStates = new Map(state.classStates);
      const currentState = newClassStates.get(classId) || createDefaultClassState();
      
      // Merge the partial state with existing state
      const newState: ClassState = {
        ...currentState,
        ...partialState,
        // Special handling for Set since it doesn't spread properly
        streamingMessageIds: partialState.streamingMessageIds || currentState.streamingMessageIds,
      };
      
      newClassStates.set(classId, newState);
      
      
      return { classStates: newClassStates };
    });
  },
  
  clearClassState: (classId: string) => {
    set((state) => {
      const newClassStates = new Map(state.classStates);
      newClassStates.delete(classId);
      return { classStates: newClassStates };
    });
  },
  
  clearAllStates: () => {
    set({ classStates: new Map() });
  },
  
  addCommandToHistory: (command: string) => {
    if (!command.trim() || !command.startsWith('/')) return;
    
    set((state) => {
      const currentHistory = state.commandHistory;
      
      // Create new history with the command at the beginning
      let newHistory = [command];
      
      // Add previous commands, excluding duplicates of the current command
      for (const cmd of currentHistory) {
        if (cmd !== command && newHistory.length < MAX_COMMAND_HISTORY) {
          newHistory.push(cmd);
        }
      }
      
      // Ensure we don't exceed max size
      newHistory = newHistory.slice(0, MAX_COMMAND_HISTORY);
      
      return { commandHistory: newHistory };
    });
  },
  
  getCommandHistory: () => {
    return get().commandHistory;
  },
    }),
    {
      name: 'lectura-class-state',
      // Only persist command history, not the entire class states
      partialize: (state) => ({ commandHistory: state.commandHistory }),
    }
  )
);