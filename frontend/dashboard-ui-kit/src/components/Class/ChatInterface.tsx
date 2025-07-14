import React, { useState, useEffect, useRef } from 'react';
import { Bot, Copy, Menu, Trash2, Check, ArrowUp } from 'lucide-react';
import { ChatMessageUI } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatInterfaceProps {
  messages: ChatMessageUI[];
  isAiLoading: boolean;
  inputMessage: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClearChat: () => void;
  streamingMessageIds: Set<string>;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
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
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiLoading]);

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

  return (
    <div className="bg-white dark:bg-neutral-800 dark:border-neutral-700 rounded-xl border flex flex-col h-full">
      {/* Header with Menu */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
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
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start ${
                message.isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`max-w-3xl ${message.isUser ? 'text-right' : 'text-left'}`}>
                {message.isUser ? (
                  // User message - no background, borders, picture, or time
                  <div className="inline-block px-4 py-3 rounded-2xl bg-orange-600 text-white">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                ) : (
                  // Assistant message - no background or borders, just content with copy button
                  <div className="space-y-2">
                    {/* Show content if available */}
                    {message.content && (
                      <div className="text-gray-900 dark:text-white">
                        <div className="text-sm leading-relaxed">
                          <MarkdownRenderer 
                            content={message.content}
                            sources={message.sources}
                            sourceMapping={message.sourceMapping}
                            isStreaming={streamingMessageIds.has(message.id)}
                            onOpenInFile={onOpenInFile}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Copy button - only show when streaming is complete */}
                    {!streamingMessageIds.has(message.id) && message.content && (
                      <div className="flex items-center">
                        <button
                          onClick={() => handleCopyMessage(message.content, message.id)}
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
          ))
        )}
        
        {isAiLoading && streamingMessageIds.size === 0 && (
          <div className="flex items-start">
            <div className="text-gray-900 dark:text-white">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Auto-scroll target */}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-6 bg-transparent">
        <form onSubmit={onSubmit} className="flex space-x-4">
          <div className="flex-1 relative max-w-2xl mx-auto">
            <textarea
              value={inputMessage}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e as any);
                }
              }}
              placeholder="Ask a question about your documents..."
              className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-neutral-700 text-gray-900 dark:text-white transition-colors duration-200 resize-none min-h-[80px] max-h-[200px] overflow-y-auto"
              rows={4}
              style={{
                height: 'auto',
                minHeight: '80px',
                maxHeight: '200px'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                const scrollHeight = target.scrollHeight;
                const maxHeight = 200; // 9 lines approximately
                if (scrollHeight > maxHeight) {
                  target.style.height = `${maxHeight}px`;
                  target.style.overflowY = 'auto';
                } else {
                  target.style.height = `${Math.max(80, scrollHeight)}px`;
                  target.style.overflowY = 'hidden';
                }
              }}
              disabled={isAiLoading}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isAiLoading}
              className="absolute right-3 bottom-4 p-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 