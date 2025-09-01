import React from 'react';
import { Copy, Check } from 'lucide-react';
import { ChatMessageUI } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageComponentProps {
  message: ChatMessageUI;
  isStreaming: boolean;
  copiedMessageId: string | null;
  onCopyMessage: (content: string, messageId: string) => void;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
  slides: Array<{ id: string; originalFileName: string }>;
}

// Memoized message component to prevent unnecessary re-renders
export const MessageComponent = React.memo<MessageComponentProps>(({ 
  message, 
  isStreaming, 
  copiedMessageId, 
  onCopyMessage, 
  onOpenInFile, 
  slides 
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
          <div className="inline-block px-4 py-3 bg-[#F97316] text-white text-left max-w-md break-words overflow-hidden" style={{ borderRadius: '1rem 0.25rem 1rem 1rem' }}>
            <div className="prose prose-base prose-invert max-w-none break-words">
              {/* Handle different message formats */}
              {(() => {
                // Check for different message patterns
                const hasSelectedTextPattern = message.content.includes('"') && message.content.includes('\n\n"');
                const isOnlyQuotedText = message.content.startsWith('"') && message.content.endsWith('"') && !message.content.includes('\n\n"');
                
                if (hasSelectedTextPattern) {
                  const parts = message.content.split('\n\n"');
                  const userPrompt = parts[0];
                  const selectedText = parts[1]?.replace(/"$/, '') || '';
                  
                  // If user prompt is empty or just whitespace, show only selected text in italic with no line limit
                  if (!userPrompt.trim()) {
                    return (
                      <p className="text-base leading-relaxed m-0 text-white italic break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        "{selectedText}"
                      </p>
                    );
                  }
                  
                  // If user has both prompt and selected text, show selected text with 3 line limit
                  return (
                    <>
                      <div 
                        className="text-sm text-orange-200 italic overflow-hidden mb-2 break-words"
                        title={selectedText}
                        style={{ 
                          wordBreak: 'break-all', 
                          overflowWrap: 'anywhere',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: '1.4rem',
                          maxHeight: '4.2rem' // 3 lines * 1.4rem line-height
                        }}
                      >
                        "{selectedText}"
                      </div>
                      <p className="text-base leading-relaxed m-0 text-white break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        {userPrompt}
                      </p>
                    </>
                  );
                }
                
                // If message is only quoted text (just selected text, no prompt)
                if (isOnlyQuotedText) {
                  const selectedText = message.content.slice(1, -1); // Remove surrounding quotes
                  return (
                    <p className="text-base leading-relaxed m-0 text-orange-200 italic break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      "{selectedText}"
                    </p>
                  );
                }
                
                // Regular message without selected text
                return (
                  <p className="text-base leading-relaxed m-0 text-white break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {message.content}
                  </p>
                );
              })()}
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