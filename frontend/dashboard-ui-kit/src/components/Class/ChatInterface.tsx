import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Copy, Menu, Trash2, Check, ArrowUp } from 'lucide-react';
import { ChatMessageUI } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { TextCloudPopup } from './TextCloudPopup';

// Memoized message component to prevent unnecessary re-renders
const MessageComponent = React.memo(({ 
  message, 
  isStreaming, 
  copiedMessageId, 
  onCopyMessage, 
  onOpenInFile, 
  slides 
}: {
  message: ChatMessageUI;
  isStreaming: boolean;
  copiedMessageId: string | null;
  onCopyMessage: (content: string, messageId: string) => void;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
  slides: Array<{ id: string; originalFileName: string }>;
}) => {
  return (
    <div
      data-message-id={message.id}
      className="flex items-start justify-center"
    >
      <div className={`${
        message.isUser 
          ? 'w-full flex justify-end max-w-4xl' 
          : 'text-left w-full max-w-4xl'
      }`}>
        {message.isUser ? (
          // User message - no background, borders, picture, or time
          <div className="inline-block px-4 py-3 rounded-2xl bg-orange-600 text-white text-left max-w-md">
            <div className="prose prose-base prose-invert max-w-none">
              {/* Show selected text first if it contains selected text */}
              {message.content.includes('"') && message.content.includes('\n\n"') ? (
                <>
                  <div 
                    className="text-sm text-orange-200 italic overflow-hidden whitespace-nowrap text-ellipsis mb-2"
                    title={message.content.split('\n\n"')[1]?.replace(/"$/, '') || ''}
                  >
                    "{message.content.split('\n\n"')[1]?.replace(/"$/, '') || ''}"
                  </div>
                  <p className="text-base leading-relaxed m-0 text-white">
                    {message.content.split('\n\n"')[0]}
                  </p>
                </>
              ) : (
                <p className="text-base leading-relaxed m-0 text-white">{message.content}</p>
              )}
            </div>
          </div>
        ) : (
          // Assistant message - no background or borders, just content with copy button
          <div className="space-y-2 mt-6">
            {/* Show content if available */}
            {message.content && (
              <div className="text-gray-900 dark:text-white">
                <div className="text-base leading-relaxed">
                  <MarkdownRenderer 
                    content={message.content}
                    sources={message.sources}
                    sourceMapping={message.sourceMapping}
                    isStreaming={isStreaming}
                    onOpenInFile={onOpenInFile}
                    slides={slides}
                  />
                </div>
              </div>
            )}
            
            {/* Copy button - only show when streaming is complete */}
            {!isStreaming && message.content && (
              <div className="flex items-center">
                <button
                  onClick={() => onCopyMessage(message.content, message.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                  title="Copy message"
                >
                  {copiedMessageId === message.id ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

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
  const [sentinelHeight, setSentinelHeight] = useState(650); // Default height
  const menuRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomSpacerRef = useRef<HTMLDivElement>(null);

  // Get last 5 Q&A pairs for rendering
  const getLastQAPairs = (allMessages: ChatMessageUI[], maxPairs: number = 5) => {
    const pairs: ChatMessageUI[] = [];
    let pairCount = 0;
    
    // Process messages from newest to oldest to find complete Q&A pairs
    for (let i = allMessages.length - 1; i >= 0 && pairCount < maxPairs; i--) {
      const message = allMessages[i];
      
      if (!message.isUser) {
        // AI message - look for the user message that comes before it
        for (let j = i - 1; j >= 0; j--) {
          if (allMessages[j].isUser) {
            // Found a Q&A pair, add both messages
            pairs.unshift(allMessages[j], message);
            pairCount++;
            i = j; // Skip the user message we just processed
            break;
          }
        }
      }
    }
    
    // If the last message is a user message without an AI response, add it
    if (allMessages.length > 0 && allMessages[allMessages.length - 1].isUser) {
      const lastUserMessage = allMessages[allMessages.length - 1];
      // Check if it's not already in pairs
      if (!pairs.some(m => m.id === lastUserMessage.id)) {
        pairs.push(lastUserMessage);
      }
    }
    
    return pairs;
  };
  
  const visibleMessages = getLastQAPairs(messages, 5);

  // Handle scroll events - simplified without bottom tracking
  const handleScroll = useCallback(() => {
    // Could add scroll-based logic here if needed
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    // Only scroll when user sends a message
    if (lastMessage.isUser) {
      // Set initial sentinel height to 800px so last message is clearly visible
      setSentinelHeight(650);
      
      // Use setTimeout to ensure DOM is updated before scrolling
      setTimeout(() => {
        const container = messagesContainerRef.current;
        if (container) {
          // Scroll to the very bottom with the larger sentinel
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth"
          });
        }
      }, 100);
    }
  }, [messages]);

  // Adjust sentinel height when AI response is complete
  useEffect(() => {
    if (messages.length < 2) return;
    
    const lastMessage = messages[messages.length - 1];
    const isAiResponseComplete = !lastMessage.isUser && !streamingMessageIds.has(lastMessage.id);
    
    if (isAiResponseComplete) {
      // Use longer timeout to ensure DOM is fully rendered
      setTimeout(() => {
        const aiMessageElement = document.querySelector(`[data-message-id="${lastMessage.id}"]`);
        
        if (aiMessageElement) {
          const aiMessageHeight = aiMessageElement.getBoundingClientRect().height;
          
          // If AI response is larger than 650px, set sentinel to 200px
          if (aiMessageHeight > 650) {
            setSentinelHeight(200);
          } else {
            // If AI response is smaller than 650px, set sentinel to 650px - response_size
            // This ensures total space (response + sentinel) = 650px
            setSentinelHeight(650 + 50 - aiMessageHeight);
          }
        }
      }, 300);
    }
  }, [messages, streamingMessageIds]);

  // Initial setup
  useEffect(() => {
    // Any initial setup logic can go here
  }, []);

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

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handleClearChat = () => {
    onClearChat();
    setShowMenu(false);
  };


  // Handle closing the cloud popup
  const handleCloseCloud = () => {
    if (onClearSelectedText) {
      onClearSelectedText();
    }
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
            {/* Simple message list - last 5 messages only */}
            <div className="space-y-0">
              {visibleMessages.map((message) => (
                <div
                  key={message.id}
                  data-message-id={message.id}
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
              ))}
            </div>
            
            {/* Loading dots - show when AI is loading and no streaming messages */}
            {isAiLoading && messages.length > 0 && messages[messages.length - 1]?.isUser && (
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
            
            {/* ChatGPT-style bottom sentinel for over-scroll breathing room */}
            <div
              ref={bottomSpacerRef}
              aria-hidden
              className="pointer-events-none"
              style={{ height: `${sentinelHeight}px` }}
            />
          </>
        )}
      </div>

      {/* ChatGPT-style input isolation - positioned outside scroll container */}
      <div className="pb-4 bg-transparent -mt-16 overflow-y-scroll relative z-50">
        <div className="max-w-4xl mx-auto px-12 py-1">
          <form onSubmit={onSubmit} className="w-full bg-transparent">
            <div className="relative">
              {/* Outer container with rounded corners and focus ring - taller when cloud is present */}
              <div className={`bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded-xl focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500 transition-all duration-200 ${selectedTextForChat ? 'pb-2' : ''}`}>
                {/* Text Cloud Popup - positioned inside input container at the top */}
                {selectedTextForChat && (
                  <div className="px-4 pt-3 pb-2">
                    <TextCloudPopup
                      text={selectedTextForChat}
                      isVisible={true}
                      onClose={handleCloseCloud}
                      inline={true}
                    />
                  </div>
                )}
                
                <textarea
                  value={inputMessage}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSubmit(e as React.FormEvent);
                    }
                  }}
                  placeholder="Ask a question about your documents..."
                  className={`w-full px-4 pr-12 border-0 focus:outline-none bg-transparent text-gray-900 dark:text-white resize-none text-base placeholder:text-base ${
                    selectedTextForChat ? 'py-2 min-h-[80px] max-h-[180px]' : 'py-3 min-h-[100px] max-h-[220px]'
                  }`}
                  rows={4}
                  style={{
                    height: 'auto',
                    minHeight: selectedTextForChat ? '80px' : '100px',
                    maxHeight: selectedTextForChat ? '180px' : '220px'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    const scrollHeight = target.scrollHeight;
                    const maxHeight = selectedTextForChat ? 180 : 220;
                    const minHeight = selectedTextForChat ? 80 : 100;
                    if (scrollHeight > maxHeight) {
                      target.style.height = `${maxHeight}px`;
                      target.style.overflowY = 'auto';
                    } else {
                      target.style.height = `${Math.max(minHeight, scrollHeight)}px`;
                      target.style.overflowY = 'hidden';
                    }
                  }}
                  disabled={isAiLoading}
                />
                <button
                  type="submit"
                  disabled={(!inputMessage.trim() && !selectedTextForChat?.trim()) || isAiLoading}
                  className="absolute right-3 bottom-4 p-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}; 