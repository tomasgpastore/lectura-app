import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Menu, Trash2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChatMessageUI } from '../../types';
import { MessageComponent } from './MessageComponent';

interface ConversationGroup {
  id: string;
  userMessage: ChatMessageUI | null;
  aiMessage: ChatMessageUI | null;
  isActive: boolean;
}

interface ChatInterfaceProps {
  messages: ChatMessageUI[];
  isAiLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClearChat: () => void;
  streamingMessageIds: Set<string>;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
  slides?: Array<{ id: string; originalFileName: string }>;
}

const ChatInterfaceComponent: React.FC<ChatInterfaceProps> = ({
  messages,
  isAiLoading,
  onSubmit,
  onClearChat,
  streamingMessageIds,
  onOpenInFile,
  slides = [],
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeGroupRef = useRef<HTMLDivElement>(null);

  // Get all chat messages in correct chronological order
  const visibleMessages = useMemo(() => {
    // API returns messages in reverse chronological order (newest first)
    // So we just need to reverse the array to get oldest first
    return [...messages].reverse();
  }, [messages]);

  // Group messages into conversation pairs
  const conversationGroups = useMemo(() => {
    const groups: ConversationGroup[] = [];
    let currentGroup: ConversationGroup | null = null;

    visibleMessages.forEach((message) => {
      if (message.isUser) {
        // Start a new group with user message
        currentGroup = {
          id: `group-${message.id}`,
          userMessage: message,
          aiMessage: null,
          isActive: false
        };
        groups.push(currentGroup);
      } else {
        if (currentGroup && !currentGroup.aiMessage) {
          // Add AI message to current group if it doesn't have one
          currentGroup.aiMessage = message;
        } else {
          // Create a new group with just AI message (orphaned case)
          groups.push({
            id: `group-orphan-${message.id}`,
            userMessage: null,
            aiMessage: message,
            isActive: false
          });
        }
      }
    });

    // All groups maintain their height, so we don't need isActive flag for height
    // But we keep it for other purposes like scrolling
    if (groups.length > 0) {
      groups[groups.length - 1].isActive = true;
    }

    return groups;
  }, [visibleMessages]);

  // Update container height and scrollbar width
  useEffect(() => {
    const updateMeasurements = () => {
      if (messagesContainerRef.current) {
        setContainerHeight(messagesContainerRef.current.clientHeight);
        
        // Calculate scrollbar width
        const scrollbarWidth = messagesContainerRef.current.offsetWidth - messagesContainerRef.current.clientWidth;
        document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
      }
    };

    updateMeasurements();
    window.addEventListener('resize', updateMeasurements);
    
    // Also update when content changes might affect scrollbar
    const observer = new ResizeObserver(updateMeasurements);
    if (messagesContainerRef.current) {
      observer.observe(messagesContainerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateMeasurements);
      observer.disconnect();
    };
  }, []);

  // Track previous groups length to detect new groups
  const prevGroupsLengthRef = useRef(0);
  
  // Initialize the virtualizer for efficient rendering
  const virtualizer = useVirtualizer({
    count: conversationGroups.length,
    getScrollElement: () => messagesContainerRef.current,
    estimateSize: useCallback(() => {
      // Estimate height for each conversation group
      return 200;
    }, []),
    overscan: 5, // Render 5 extra items on each side
    scrollMargin: 0,
    scrollPaddingStart: 0,
    scrollPaddingEnd: 0,
    getItemKey: useCallback((index: number) => `group-${index}`, []),
  });
  
  // Effect to manage scrolling - triggers on initial render and when conversation groups change
  useEffect(() => {
    if (!messagesContainerRef.current || conversationGroups.length === 0) return;
    
    const isMount = prevGroupsLengthRef.current === 0;
    const isNewMessage = conversationGroups.length > prevGroupsLengthRef.current;
    
    // On initial mount or when switching classes, scroll without animation
    if (isMount || (!isNewMessage && conversationGroups.length > 0)) {
      virtualizer.scrollToIndex(conversationGroups.length - 1, {
        align: 'end'
      });
    }
    // For new messages, use smooth scrolling
    else if (isNewMessage) {
      virtualizer.scrollToIndex(conversationGroups.length - 1, {
        align: 'end',
        behavior: 'smooth'
      });
    }
    
    // Update the ref
    prevGroupsLengthRef.current = conversationGroups.length;
  }, [conversationGroups.length, virtualizer]);

  // Auto-scroll in the active group while AI is typing
  useEffect(() => {
    if (isAiLoading && activeGroupRef.current) {
      const groupContent = activeGroupRef.current.querySelector('.group-content');
      if (groupContent) {
        // Smooth scroll to bottom as content grows
        groupContent.scrollTo({
          top: groupContent.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [isAiLoading, messages]);
  
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
    <div className="flex flex-col h-full">
      <style>{`
        @keyframes slideInFromBottom {
          0% {
            opacity: 0;
            transform: translateY(80px);
          }
          12.5% {
            opacity: 1;
            transform: translateY(70px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
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

      {/* Chat Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative"
      >
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <img 
              src="/icon.svg" 
              alt="Lectura Icon" 
              className="w-16 h-16 mx-auto mb-4"
            />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Ready to help you learn
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Upload your documents and start asking questions about your course materials.
            </p>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Container for all visible items with proper transform */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualizer.getVirtualItems()[0]?.start ?? 0}px)`,
              }}
            >
              {/* Only render visible conversation groups */}
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const group = conversationGroups[virtualItem.index];
                const isLastGroup = virtualItem.index === conversationGroups.length - 1;
                const isStreaming = group.aiMessage && streamingMessageIds.has(group.aiMessage.id);
                const isNewGroup = virtualItem.index >= prevGroupsLengthRef.current;
                
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    className="conversation-group"
                    style={{
                      minHeight: isLastGroup ? `${containerHeight}px` : 'auto',
                      animation: isLastGroup && isNewGroup ? 'slideInFromBottom 1.2s ease-out forwards' : 'none'
                    }}
                  >
                    <div 
                      ref={isLastGroup ? activeGroupRef : null}
                      className={`group-content flex flex-col justify-start ${
                        isLastGroup ? 'py-6 pb-[150px]' : 'py-6'
                      }`}
                    >
                      {/* User Message */}
                      {group.userMessage && (
                        <div className="max-w-4xl w-full mx-auto px-8">
                          <MessageComponent
                            message={group.userMessage}
                            isStreaming={false}
                            copiedMessageId={copiedMessageId}
                            onCopyMessage={handleCopyMessage}
                            onOpenInFile={onOpenInFile}
                            slides={slides}
                          />
                        </div>
                      )}
                      
                      {/* AI Message */}
                      {group.aiMessage && (
                        <div className="max-w-4xl w-full mx-auto px-8 mt-4">
                          <MessageComponent
                            message={group.aiMessage}
                            isStreaming={isStreaming || false}
                            copiedMessageId={copiedMessageId}
                            onCopyMessage={handleCopyMessage}
                            onOpenInFile={onOpenInFile}
                            slides={slides}
                          />
                        </div>
                      )}
                      
                      {/* Loading indicator for active group */}
                      {isLastGroup && isAiLoading && !group.aiMessage && (
                        <div className="max-w-4xl w-full mx-auto px-8 mt-4">
                          <div className="flex justify-start">
                            <div className="flex space-x-1 items-center">
                              <div className="w-2 h-2 bg-[#F97316] dark:bg-[#F97316]/80 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-[#F97316] dark:bg-[#F97316]/80 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-[#F97316] dark:bg-[#F97316]/80 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Bottom spacer to account for overlapping input */}
        <div className="h-20 flex-shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
};

// Export the component directly as it no longer needs special memoization
export const ChatInterface = memo(ChatInterfaceComponent);