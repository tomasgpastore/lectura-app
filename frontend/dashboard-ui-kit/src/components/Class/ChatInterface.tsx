import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Bot, Menu, Trash2 } from 'lucide-react';
import { ChatMessageUI } from '../../types';
import { MessageComponent } from './MessageComponent';
import { ChatInputOptimized, ChatInputHandle } from './ChatInputOptimized';


interface ChatInterfaceProps {
  messages: ChatMessageUI[];
  isAiLoading: boolean;
  inputMessage: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClearChat: () => void;
  streamingMessageIds: Set<string>;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
  slides?: Array<{ id: string; originalFileName: string }>;
  selectedTextForChat?: string;
  onClearSelectedText?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isAiLoading,
  inputMessage,
  onInputChange,
  onSubmit,
  onClearChat,
  streamingMessageIds,
  onOpenInFile,
  slides = [],
  selectedTextForChat,
  onClearSelectedText,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const sentinelHeight = 150; // Always 150px - no dynamic calculation
  const menuRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomSpacerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Get all chat messages in correct chronological order
  const visibleMessages = useMemo(() => {
    // API returns messages in reverse chronological order (newest first)
    // So we just need to reverse the array to get oldest first
    return [...messages].reverse();
  }, [messages]);

  // Initialize the virtualizer
  const virtualizer = useVirtualizer({
    count: visibleMessages.length,
    getScrollElement: () => messagesContainerRef.current,
    estimateSize: () => 100, // Estimated height of each message
    overscan: 5, // Render 5 extra items on each side
  });

  // Handle scroll events - simplified without bottom tracking
  const handleScroll = useCallback(() => {
    // Could add scroll-based logic here if needed
  }, []);

  // Refs for scroll behavior
  const hasScrolledRef = useRef(false);

  // Simple scroll to bottom on new messages
  useEffect(() => {
    if (messages.length === 0) return;
    
    // Scroll to bottom when new messages arrive
    const scrollToBottom = () => {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    };
    
    // Wait for DOM to update
    setTimeout(scrollToBottom, 100);
  }, [messages.length]);



  // Scroll to bottom on page refresh/initial load
  const hasInitiallyScrolledRef = useRef(false);
  useEffect(() => {
    if (visibleMessages.length > 0 && messagesContainerRef.current && !hasInitiallyScrolledRef.current) {
      hasInitiallyScrolledRef.current = true;
      
      // Wait for virtualizer to render all items
      const scrollToBottom = () => {
        const container = messagesContainerRef.current;
        if (container) {
          // Force virtualizer to render all items first
          virtualizer.scrollToIndex(visibleMessages.length - 1, { align: 'end' });
          
          // Then scroll container to bottom
          setTimeout(() => {
            container.scrollTo({
              top: container.scrollHeight,
              behavior: "auto"
            });
          }, 100);
        }
      };
      
      // Give time for initial render
      setTimeout(scrollToBottom, 300);
    }
  }, [visibleMessages.length, virtualizer]); // Run when messages load

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyMessage = useCallback(async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  }, []);

  const handleClearChat = () => {
    onClearChat();
    setShowMenu(false);
  };

  return (
    <div className="bg-white dark:bg-neutral-800 dark:border-neutral-700 rounded-xl border flex flex-col h-full">
      {/* Header with Menu */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-neutral-700 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Chat</h3>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg z-10">
              <button
                onClick={handleClearChat}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-6 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Ready to help you learn
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Upload your documents and start asking questions about your course materials.
            </p>
          </div>
        ) : (
          <>
            {/* Virtualized Message Container */}
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {/* Virtual items - positioned absolutely */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualizer.getVirtualItems()[0]?.start ?? 0}px)`,
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const message = visibleMessages[virtualItem.index];
                  return (
                    <div
                      key={virtualItem.key}
                      data-index={virtualItem.index}
                      data-message-id={message.id}
                      ref={virtualizer.measureElement}
                      className="max-w-4xl mx-auto px-12 py-4"
                    >
                      <MessageComponent
                        message={message}
                        isStreaming={streamingMessageIds.has(message.id)}
                        copiedMessageId={copiedMessageId}
                        onCopyMessage={handleCopyMessage}
                        onOpenInFile={onOpenInFile}
                        slides={slides}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Loading dots - show when AI is loading */}
            {isAiLoading && (
              <div className="max-w-4xl mx-auto px-12 py-4">
                <div className="flex items-start justify-start">
                  <div className="text-gray-900 dark:text-white w-full">
                    <div className="flex space-x-1 items-center">
                      <div className="w-2 h-2 bg-orange-500 dark:bg-orange-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-orange-500 dark:bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-orange-500 dark:bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* ChatGPT-style bottom sentinel - ALWAYS at the very bottom */}
        <div
          ref={bottomSpacerRef}
          aria-hidden
          className="pointer-events-none flex-shrink-0"
          style={{ 
            height: `${sentinelHeight}px`,
            transition: 'height 0.3s ease-out'
          }}
        />
      </div>

      {/* ChatGPT-style input isolation - positioned outside scroll container */}
      <ChatInputOptimized
        ref={chatInputRef}
        onSubmit={(message) => {
          // Create a fake event with the message
          const fakeEvent = {
            preventDefault: () => {},
            currentMessage: message
          } as any;
          onSubmit(fakeEvent);
        }}
        isAiLoading={isAiLoading}
        selectedTextForChat={selectedTextForChat}
        onClearSelectedText={onClearSelectedText}
      />
    </div>
  );
};