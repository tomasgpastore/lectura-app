import React from 'react';
import { Send, Bot, User } from 'lucide-react';
import { ChatMessage } from '../../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isAiLoading: boolean;
  inputMessage: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isAiLoading,
  inputMessage,
  onInputChange,
  onSubmit,
}) => {
  return (
    <div className="bg-white dark:bg-neutral-800 dark:border-neutral-700 rounded-xl border flex flex-col h-full">
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
              Upload your documents and start asking questions. This is a UI demonstration - messages will show mock responses.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-4 ${
                message.isUser ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                message.isUser 
                  ? 'bg-gray-200 dark:bg-neutral-700' 
                  : 'bg-gradient-to-br from-orange-500 to-red-600'
              }`}>
                {message.isUser ? (
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              
              <div className={`flex-1 max-w-3xl ${message.isUser ? 'text-right' : ''}`}>
                <div className={`inline-block px-4 py-3 rounded-2xl ${
                  message.isUser
                    ? 'bg-orange-600 text-white'
                    : 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-700'
                }`}>
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        
        {isAiLoading && (
          <div className="flex items-start space-x-4">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-2xl px-4 py-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="p-6 bg-transparent">
        <form onSubmit={onSubmit} className="flex space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Ask a question about your documents..."
              className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-neutral-700 text-gray-900 dark:text-white transition-colors duration-200"
              disabled={isAiLoading}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isAiLoading}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 