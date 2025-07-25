import React, { useRef, memo, useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ArrowUp, Plus } from 'lucide-react';
import { TextCloudPopup } from './TextCloudPopup';
import { CommandSuggestions } from './CommandSuggestions';
import { FileSuggestions } from './FileSuggestions';
import { ClassSuggestions } from './ClassSuggestions';
import { DocumentSuggestions } from './DocumentSuggestions';
import { IndicatorsList, IndicatorItem } from './IndicatorsList';
import { Course } from '../../types';
import { useCommands, useTextInputHandler, useKeyboardNavigation, useCommandHistory } from './commands';

interface Document {
  id: string;
  name: string;
}

interface FileItem {
  id: string;
  name: string;
  type: string;
}

// Minimal props - only what's absolutely necessary for functionality
interface ChatInputStandaloneProps {
  onSendMessage: (message: string, indicatorItems: IndicatorItem[]) => void;
  isAiLoading: boolean;
  
  // Optional features
  selectedTextForChat?: string;
  onClearSelectedText?: () => void;
  isPdfPreviewOpen?: boolean;
  
  // Data for suggestions/commands
  files?: FileItem[];
  courses?: Course[];
  documents?: Document[];
  
  // Command callbacks
  onClearChat?: () => void;
  onOpenDocument?: (documentId: string) => void;
  onRemoveDocument?: (documentId: string) => void;
  onRenameDocument?: (documentId: string, newName: string) => void;
  onFilesUploaded?: (files: File[]) => void;
}

export interface ChatInputStandaloneHandle {
  focus: () => void;
  clear: () => void;
}

export const ChatInputStandalone = memo(forwardRef<ChatInputStandaloneHandle, ChatInputStandaloneProps>(({
  onSendMessage,
  isAiLoading,
  selectedTextForChat,
  onClearSelectedText,
  isPdfPreviewOpen,
  files = [],
  courses = [],
  documents = [],
  onClearChat,
  onOpenDocument,
  onRemoveDocument,
  onRenameDocument,
  onFilesUploaded,
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastHeightRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // All state is managed internally
  const [inputValue, setInputValue] = useState('');
  const [indicatorItems, setIndicatorItems] = useState<IndicatorItem[]>([]);
  
  // File suggestions state
  const [showFiles, setShowFiles] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [fileFilter, setFileFilter] = useState('');
  
  // Handle PDF preview state changes
  useEffect(() => {
    // Remove any existing current-page indicator
    const filtered = indicatorItems.filter(item => item.type !== 'current-page');
    
    if (isPdfPreviewOpen) {
      // Add current page indicator at the beginning
      const newItems = [{
        id: 'current-page',
        type: 'current-page' as const,
        name: 'Current page',
        removable: false
      }, ...filtered];
      setIndicatorItems(newItems);
    } else {
      setIndicatorItems(filtered);
    }
  }, [isPdfPreviewOpen]);

  // Reset height when clearing
  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      const minHeight = 60;
      textareaRef.current.style.height = `${minHeight}px`;
      textareaRef.current.style.overflowY = 'hidden';
      lastHeightRef.current = minHeight;
    }
  }, []);

  // Use command history hook
  const { addToHistory, navigateHistory, resetHistoryNavigation } = useCommandHistory();

  // Use commands hook
  const {
    showCommands,
    setShowCommands,
    selectedCommandIndex,
    setSelectedCommandIndex,
    commandFilter,
    setCommandFilter,
    showClassSuggestions,
    setShowClassSuggestions,
    selectedClassIndex,
    setSelectedClassIndex,
    classFilter,
    setClassFilter,
    showDocumentSuggestions,
    setShowDocumentSuggestions,
    selectedDocumentIndex,
    setSelectedDocumentIndex,
    documentFilter,
    setDocumentFilter,
    allCommands,
    filteredCommands,
    filteredCourses,
    filteredDocuments,
    selectCommand,
    selectClass,
    selectDocument,
    executeCommandWithParameter,
  } = useCommands({
    onClearChat,
    courses,
    documents,
    onOpenDocument,
    onRemoveDocument,
    onRenameDocument,
    setInternalValue: setInputValue,
    textareaRef,
    resetHeight,
    addToHistory,
  });

  // Filter files based on input
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(fileFilter.toLowerCase())
  );

  // Define adjustHeight first to avoid reference errors
  const adjustHeight = useCallback(() => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const maxHeight = 220;
    const minHeight = 60;
    
    // Store current scroll position
    const currentScrollTop = textarea.scrollTop;
    const wasAtBottom = textarea.scrollTop + textarea.clientHeight >= textarea.scrollHeight - 5;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Get the scroll height
    const scrollHeight = textarea.scrollHeight;
    
    // Set the appropriate height
    if (scrollHeight > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = 'auto';
      
      // If we were at the bottom, scroll to the new bottom
      if (wasAtBottom) {
        textarea.scrollTop = textarea.scrollHeight;
      } else {
        // Otherwise restore scroll position
        textarea.scrollTop = currentScrollTop;
      }
    } else if (scrollHeight > minHeight) {
      textarea.style.height = `${scrollHeight}px`;
      textarea.style.overflowY = 'hidden';
    } else {
      textarea.style.height = `${minHeight}px`;
      textarea.style.overflowY = 'hidden';
    }
    
    lastHeightRef.current = scrollHeight;
  }, []);

  const handleInput = useCallback(() => {
    // Use RAF for smooth updates
    requestAnimationFrame(adjustHeight);
  }, [adjustHeight]);

  // Handle file selection
  const selectFile = useCallback((file: FileItem) => {
    // Add to indicator items if not already there
    const currentItems = indicatorItems;
    
    if (!currentItems.some(item => item.id === file.id)) {
      const newItem = {
        id: file.id,
        type: 'document' as const,
        name: file.name,
        removable: true
      };
      const newItems = [...currentItems, newItem];
      setIndicatorItems(newItems);
    }
    
    // Clear the @ mention from input
    const currentValue = inputValue;
    const lastAtIndex = currentValue.lastIndexOf('@');
    const newValue = currentValue.substring(0, lastAtIndex);
    
    setInputValue(newValue);
    if (textareaRef.current) {
      textareaRef.current.value = newValue;
      // Trigger height adjustment
      requestAnimationFrame(() => {
        handleInput();
      });
    }
    setShowFiles(false);
    setFileFilter('');
    setSelectedFileIndex(0);
  }, [inputValue, handleInput, indicatorItems]);

  // Handle removing indicator item
  const removeIndicatorItem = useCallback((itemId: string) => {
    const filtered = indicatorItems.filter(item => item.id !== itemId);
    setIndicatorItems(filtered);
  }, [indicatorItems]);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    clear: () => {
      setInputValue('');
      setIndicatorItems([]);
      if (textareaRef.current) {
        textareaRef.current.value = '';
        resetHeight();
      }
    }
  }), [resetHeight]);

  const handleCloseCloud = useCallback(() => {
    onClearSelectedText?.();
  }, [onClearSelectedText]);

  // Sync textarea value with internal value
  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== inputValue) {
      textareaRef.current.value = inputValue;
      handleInput();
    }
  }, [inputValue, handleInput]);

  // Use text input handler
  const { handleTextChange: handleTextChangeLogic } = useTextInputHandler({
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
  });

  // Handle text change
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Reset history navigation when user types
    resetHistoryNavigation();
    
    // Get the current cursor position
    const cursorPosition = e.target.selectionStart;
    handleTextChangeLogic(value, cursorPosition);
  }, [handleTextChangeLogic, resetHistoryNavigation]);

  // Use keyboard navigation
  const { handleKeyDown: handleKeyboardNavigation } = useKeyboardNavigation({
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
    setInternalValue: setInputValue,
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
  });

  const handleSubmit = useCallback(() => {
    const trimmedValue = inputValue.trim();
    
    // Handle commands
    if (trimmedValue.startsWith('/')) {
      // Handle commands with parameters
      const commandPrefixes = ['/theme ', '/cd ', '/open ', '/remove ', '/rename '];
      const matchedPrefix = commandPrefixes.find(prefix => trimmedValue.startsWith(prefix));
      
      if (matchedPrefix) {
        const param = trimmedValue.substring(matchedPrefix.length).trim();
        addToHistory(trimmedValue);
        executeCommandWithParameter(matchedPrefix.trim(), param);
        return;
      }
      
      // Handle simple commands
      const matchedCommand = allCommands.find(cmd => cmd.name === trimmedValue);
      if (matchedCommand) {
        addToHistory(trimmedValue);
        matchedCommand.action();
        return;
      }
    }
    
    // Send message if not a command
    if (!isAiLoading && (trimmedValue || selectedTextForChat?.trim())) {
      // Combine message with selected text if needed
      let finalMessage = trimmedValue;
      if (selectedTextForChat?.trim()) {
        finalMessage = trimmedValue 
          ? `${trimmedValue}\n\n"${selectedTextForChat}"`
          : `"${selectedTextForChat}"`; // Always wrap in quotes
      }
      
      // Send message with current indicator items
      onSendMessage(finalMessage, [...indicatorItems]);
      
      // Clear input
      setInputValue('');
      if (textareaRef.current) {
        textareaRef.current.value = '';
        resetHeight();
      }
    }
  }, [inputValue, selectedTextForChat, isAiLoading, indicatorItems, onSendMessage, 
      allCommands, executeCommandWithParameter, addToHistory, resetHeight]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle command history navigation when input is empty or starts with "/"
    if ((inputValue.trim() === '' || inputValue.startsWith('/')) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      // Don't navigate history if any suggestions are showing
      if (showFiles || showCommands || showClassSuggestions || showDocumentSuggestions) {
        // Let normal keyboard navigation handle it
      } else {
        e.preventDefault();
        const historyCommand = navigateHistory(e.key === 'ArrowUp' ? 'up' : 'down', inputValue);
        if (historyCommand !== null) {
          setInputValue(historyCommand);
          if (textareaRef.current) {
            textareaRef.current.value = historyCommand;
            // Move cursor to end
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.setSelectionRange(historyCommand.length, historyCommand.length);
              }
            }, 0);
          }
        }
        return;
      }
    }

    // First, let keyboard navigation handle the event
    const handled = handleKeyboardNavigation(e);
    if (handled) return;

    // Handle Enter key for submission
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSubmit();
    }
  }, [handleKeyboardNavigation, inputValue, handleSubmit, navigateHistory,
      showFiles, showCommands, showClassSuggestions, showDocumentSuggestions]);

  const handleFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSubmit();
  }, [handleSubmit]);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white dark:from-neutral-800 via-white/95 dark:via-neutral-800/95 to-transparent pt-8 pb-4 pointer-events-none" style={{ paddingRight: 'var(--scrollbar-width, 0px)' }}>
      <div className="max-w-4xl mx-auto px-8 pointer-events-auto">
        <form onSubmit={handleFormSubmit} className="w-full">
          <div className="relative">
            <div className="relative bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded-xl focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500 shadow-lg">
              {showCommands && (
                <CommandSuggestions
                  commands={filteredCommands}
                  selectedIndex={selectedCommandIndex}
                  onSelectCommand={selectCommand}
                />
              )}
              {showFiles && (
                <FileSuggestions
                  files={filteredFiles}
                  selectedIndex={selectedFileIndex}
                  onSelectFile={selectFile}
                />
              )}
              {showClassSuggestions && (
                <ClassSuggestions
                  courses={filteredCourses}
                  selectedIndex={selectedClassIndex}
                  onSelectClass={selectClass}
                />
              )}
              {showDocumentSuggestions && (
                <DocumentSuggestions
                  documents={filteredDocuments}
                  selectedIndex={selectedDocumentIndex}
                  onSelectDocument={selectDocument}
                />
              )}
              {selectedTextForChat && (
                <div className="pt-1.5 pl-1.5 pr-1.5">
                  <TextCloudPopup
                    text={selectedTextForChat}
                    isVisible={true}
                    onClose={handleCloseCloud}
                  />
                </div>
              )}
              
              {indicatorItems.length > 0 && (
                <div className="px-1.5 pt-1.5">
                  <IndicatorsList 
                    items={indicatorItems} 
                    onRemoveItem={removeIndicatorItem}
                  />
                </div>
              )}
              
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleTextChange}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your documents..."
                className="w-full px-1.5 border-0 focus:outline-none bg-transparent text-gray-900 dark:text-white resize-none text-base placeholder:text-base py-1.5 min-h-[60px] max-h-[220px]"
                rows={2}
                style={{
                  minHeight: '60px',
                  maxHeight: '220px',
                  height: '60px',
                  overflow: 'auto'
                }}
                disabled={false}
              />

              <div className="pr-1.5 pb-1.5 pl-1.5 flex justify-between items-center gap-1">
                {onFilesUploaded && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-md transition-all duration-200 hover:bg-gray-100 dark:hover:bg-neutral-600"
                      title="Upload PDF"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={(e) => {
                        const selectedFiles = Array.from(e.target.files || []);
                        if (selectedFiles.length > 0) {
                          onFilesUploaded(selectedFiles);
                          // Clear the input so the same file can be selected again
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                    />
                  </>
                )}
                <button
                  type="submit"
                  disabled={isAiLoading || (!inputValue.trim() && !selectedTextForChat?.trim())}
                  className={`p-2 text-white rounded-md transition-all duration-200 disabled:cursor-not-allowed ${
                    isAiLoading || (!inputValue.trim() && !selectedTextForChat?.trim())
                      ? 'bg-[#F97316]/40 hover:bg-[#F97316]/40'
                      : 'bg-[#F97316] hover:bg-[#F97316]/90 active:bg-[#F97316]/80'
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}));

ChatInputStandalone.displayName = 'ChatInputStandalone';