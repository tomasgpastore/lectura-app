import React, { useRef, useEffect, memo, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { TextCloudPopup } from './TextCloudPopup';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isAiLoading: boolean;
  selectedTextForChat?: string;
  onClearSelectedText?: () => void;
}

export interface ChatInputHandle {
  focus: () => void;
  clear: () => void;
}

export const ChatInputOptimized = memo(forwardRef<ChatInputHandle, ChatInputProps>(({
  onSubmit,
  isAiLoading,
  selectedTextForChat,
  onClearSelectedText,
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastHeightRef = useRef<number>(0);
  const [internalValue, setInternalValue] = useState('');

  // Reset height when clearing
  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      const minHeight = selectedTextForChat ? 80 : 100;
      textareaRef.current.style.height = `${minHeight}px`;
      textareaRef.current.style.overflowY = 'hidden';
      lastHeightRef.current = minHeight;
    }
  }, [selectedTextForChat]);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    clear: () => {
      setInternalValue('');
      if (textareaRef.current) {
        textareaRef.current.value = '';
        resetHeight();
      }
    }
  }), [resetHeight]);

  // Optimized resize handler
  const adjustHeight = useCallback(() => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const maxHeight = selectedTextForChat ? 180 : 220;
    const minHeight = selectedTextForChat ? 80 : 100;
    
    // Get the scroll height
    const scrollHeight = textarea.scrollHeight;
    
    // Only update if height changed significantly (more than 5px)
    if (Math.abs(scrollHeight - lastHeightRef.current) > 5) {
      if (scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      } else if (scrollHeight > minHeight) {
        textarea.style.height = `${scrollHeight}px`;
        textarea.style.overflowY = 'hidden';
      } else {
        textarea.style.height = `${minHeight}px`;
        textarea.style.overflowY = 'hidden';
      }
      lastHeightRef.current = scrollHeight;
    }
  }, [selectedTextForChat]);

  const handleInput = useCallback(() => {
    // Use RAF for smooth updates
    requestAnimationFrame(adjustHeight);
  }, [adjustHeight]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      
      // Only submit if AI is not loading
      if (!isAiLoading && (internalValue.trim() || selectedTextForChat?.trim())) {
        onSubmit(internalValue);
        setInternalValue('');
        if (textareaRef.current) {
          textareaRef.current.value = '';
          resetHeight();
        }
      }
    }
  }, [internalValue, selectedTextForChat, onSubmit, resetHeight, isAiLoading]);

  const handleFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only submit if AI is not loading
    if (!isAiLoading && (internalValue.trim() || selectedTextForChat?.trim())) {
      onSubmit(internalValue);
      setInternalValue('');
      if (textareaRef.current) {
        textareaRef.current.value = '';
        resetHeight();
      }
    }
  }, [internalValue, selectedTextForChat, onSubmit, resetHeight, isAiLoading]);

  const handleCloseCloud = useCallback(() => {
    onClearSelectedText?.();
  }, [onClearSelectedText]);

  return (
    <div className="pb-4 bg-transparent -mt-16 overflow-y-scroll relative z-50">
      <div className="max-w-4xl mx-auto px-12 py-1">
        <form onSubmit={handleFormSubmit} className="w-full bg-transparent">
          <div className="relative">
            <div className={`bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded-xl focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500 ${selectedTextForChat ? 'pb-2' : ''}`}>
              {selectedTextForChat && (
                <div className="pt-1.5 pl-1.5 pr-1.5 pb-2">
                  <TextCloudPopup
                    text={selectedTextForChat}
                    isVisible={true}
                    onClose={handleCloseCloud}
                  />
                </div>
              )}
              
              <textarea
                ref={textareaRef}
                value={internalValue}
                onChange={(e) => setInternalValue(e.target.value)}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your documents..."
                className={`w-full px-4 pr-12 border-0 focus:outline-none bg-transparent text-gray-900 dark:text-white resize-none text-base placeholder:text-base ${
                  selectedTextForChat ? 'py-2 min-h-[80px] max-h-[180px]' : 'py-3 min-h-[100px] max-h-[220px]'
                }`}
                rows={4}
                style={{
                  minHeight: selectedTextForChat ? '80px' : '100px',
                  maxHeight: selectedTextForChat ? '180px' : '220px',
                  height: selectedTextForChat ? '80px' : '100px'
                }}
                disabled={false}
              />
              <button
                type="submit"
                disabled={isAiLoading || (!internalValue.trim() && !selectedTextForChat?.trim())}
                className="absolute right-2 bottom-2 p-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded transition-colors duration-200 disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}));

ChatInputOptimized.displayName = 'ChatInputOptimized';