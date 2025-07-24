import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Menu, Trash2 } from 'lucide-react';
import { ChatMessageUI, Course } from '../../types';
import { MessageComponent } from './MessageComponent';
import { ChatInputOptimized, ChatInputHandle } from './ChatInputOptimized';

interface Document {
  id: string;
  name: string;
}

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
  selectedTextForChat?: string;
  onClearSelectedText?: () => void;
  isPdfPreviewOpen?: boolean;
  currentPdfPage?: number;
  indicatorItems?: Array<{ id: string; type: 'current-page' | 'document'; name: string; removable: boolean }>;
  onIndicatorItemsChange?: (items: Array<{ id: string; type: 'current-page' | 'document'; name: string; removable: boolean }>) => void;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  courses?: Course[];
  documents?: Document[];
  onOpenDocument?: (documentId: string) => void;
  onRemoveDocument?: (documentId: string) => void;
  onRenameDocument?: (documentId: string, newName: string) => void;
  onFilesUploaded?: (files: File[]) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isAiLoading,
  onSubmit,
  onClearChat,
  streamingMessageIds,
  onOpenInFile,
  slides = [],
  selectedTextForChat,
  onClearSelectedText,
  isPdfPreviewOpen,
  currentPdfPage,
  indicatorItems,
  onIndicatorItemsChange,
  inputValue,
  onInputValueChange,
  courses = [],
  documents = [],
  onOpenDocument,
  onRemoveDocument,
  onRenameDocument,
  onFilesUploaded,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeGroupRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);

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

  // Update container height
  useEffect(() => {
    const updateHeight = () => {
      if (messagesContainerRef.current) {
        setContainerHeight(messagesContainerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Scroll to active group when a new one is created
  useEffect(() => {
    if (activeGroupRef.current && messagesContainerRef.current && conversationGroups.length > 0) {
      // Delay scroll to allow animation to play
      setTimeout(() => {
        activeGroupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [conversationGroups.length]);

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
    <div className="bg-white dark:bg-neutral-800 dark:border-neutral-700 rounded-xl border flex flex-col h-full">
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
          <>
            {/* Conversation Groups */}
            {conversationGroups.map((group, index) => {
              const isLastGroup = index === conversationGroups.length - 1;
              const isStreaming = group.aiMessage && streamingMessageIds.has(group.aiMessage.id);
              
              return (
                <div
                  key={group.id}
                  ref={isLastGroup ? activeGroupRef : null}
                  className="conversation-group relative"
                  style={{ 
                    minHeight: isLastGroup ? `${containerHeight}px` : 'auto',
                    height: isLastGroup ? `${containerHeight}px` : 'auto',
                    animation: isLastGroup ? 'slideInFromBottom 1.2s ease-out forwards' : 'none'
                  }}
                >
                  <div 
                    className={`group-content flex flex-col justify-start ${
                      isLastGroup ? 'h-full overflow-y-auto py-6 pb-[100px]' : 'py-6'
                    }`}
                  >
                    {/* User Message */}
                    {group.userMessage && (
                      <div className="max-w-4xl w-full mx-auto px-12">
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
                      <div className="max-w-4xl w-full mx-auto px-12 mt-4">
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
                      <div className="max-w-4xl w-full mx-auto px-12 mt-4">
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
          </>
        )}
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
        isPdfPreviewOpen={isPdfPreviewOpen}
        currentPdfPage={currentPdfPage}
        onClearChat={onClearChat}
        files={slides?.map(slide => ({
          id: slide.id,
          name: slide.originalFileName,
          type: 'PDF'
        })) || []}
        courses={courses}
        indicatorItems={indicatorItems}
        onIndicatorItemsChange={onIndicatorItemsChange}
        value={inputValue}
        onValueChange={onInputValueChange}
        documents={slides?.map(slide => ({
          id: slide.id,
          name: slide.originalFileName
        })) || []}
        onOpenDocument={onOpenDocument}
        onRemoveDocument={onRemoveDocument}
        onRenameDocument={onRenameDocument}
        onFilesUploaded={onFilesUploaded}
      />
    </div>
  );
};