import React, { useState } from 'react';
import { ChatSource } from '../../types';

interface MarkdownRendererProps {
  content: string;
  sources?: ChatSource[];
  sourceMapping?: Record<number, ChatSource>;
  isStreaming?: boolean;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
}

interface SourceModalProps {
  source: ChatSource | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
}

const SourceModal: React.FC<SourceModalProps> = ({ source, isOpen, onClose, onOpenInFile }) => {
  if (!isOpen || !source) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Source Details
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <div className="text-gray-900 dark:text-white bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                {source.raw_text}
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-neutral-700">
              <button
                onClick={() => {
                  if (onOpenInFile) {
                    onOpenInFile(source.s3_file_name, source.page_start, source.raw_text);
                    onClose();
                  }
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
              >
                Open in file
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  sources = [], 
  sourceMapping = {},
  isStreaming = false,
  onOpenInFile 
}) => {
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSourceClick = (sourceNumber: number) => {
    // Try to get source from mapping first, then fallback to array
    const source = sourceMapping[sourceNumber] || sources[sourceNumber - 1];
    if (source) {
      setSelectedSource(source);
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSource(null);
  };

  const renderMarkdown = (text: string) => {
    let parts = [];
    let currentText = text;
    let key = 0;

    // Split by source citations [Source X] or [Source X, Source Y, ...]
    const sourceRegex = /\[Source ([^\]]+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = sourceRegex.exec(text)) !== null) {
      // Add text before the source
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        parts.push(
          <span key={key++}>
            {renderTextWithMarkdown(beforeText)}
          </span>
        );
      }

      // Parse multiple source numbers (e.g., "1, 2" or "1")
      const sourceNumbers = match[1]
        .split(',')
        .map(s => s.trim())
        .map(s => parseInt(s.replace(/Source\s*/i, '')))
        .filter(n => !isNaN(n));

      // Add source buttons
      const sourceButtons = sourceNumbers.map((sourceNumber, index) => (
        <button
          key={`${key++}-${sourceNumber}`}
          onClick={() => handleSourceClick(sourceNumber)}
          className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 rounded-md transition-colors mx-0.5"
        >
{sourceNumber}
        </button>
      ));

      parts.push(
        <span key={key++} className="inline-flex items-center flex-wrap gap-1">
          {sourceButtons}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      parts.push(
        <span key={key++}>
          {renderTextWithMarkdown(remainingText)}
        </span>
      );
    }

    return parts.length > 0 ? parts : renderTextWithMarkdown(text);
  };

  const renderTextWithMarkdown = (text: string) => {
    // Handle basic markdown: **bold**, *italic*, `code`
    const parts = [];
    let currentText = text;
    let key = 0;

    // Bold text **text**
    currentText = currentText.replace(/\*\*(.*?)\*\*/g, (match, p1) => {
      const placeholder = `__BOLD_${key++}__`;
      parts.push({ type: 'bold', content: p1, placeholder });
      return placeholder;
    });

    // Italic text *text*
    currentText = currentText.replace(/\*(.*?)\*/g, (match, p1) => {
      const placeholder = `__ITALIC_${key++}__`;
      parts.push({ type: 'italic', content: p1, placeholder });
      return placeholder;
    });

    // Inline code `text`
    currentText = currentText.replace(/`(.*?)`/g, (match, p1) => {
      const placeholder = `__CODE_${key++}__`;
      parts.push({ type: 'code', content: p1, placeholder });
      return placeholder;
    });

    // Split by placeholders and render
    let result = [currentText];
    parts.forEach((part, index) => {
      result = result.flatMap(item => {
        if (typeof item === 'string' && item.includes(part.placeholder)) {
          const splitParts = item.split(part.placeholder);
          const renderedPart = part.type === 'bold' 
            ? <strong key={`bold-${index}`}>{part.content}</strong>
            : part.type === 'italic'
            ? <em key={`italic-${index}`}>{part.content}</em>
            : <code key={`code-${index}`} className="bg-gray-100 dark:bg-neutral-700 px-1 py-0.5 rounded text-sm font-mono">{part.content}</code>;
          
          return splitParts.length > 1 
            ? [splitParts[0], renderedPart, ...splitParts.slice(1)]
            : [renderedPart];
        }
        return [item];
      });
    });

    return result.map((item, index) => 
      typeof item === 'string' ? (
        <span key={index}>{item}</span>
      ) : item
    );
  };

  return (
    <>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <div className="whitespace-pre-wrap">
          {renderMarkdown(content)}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-orange-600 dark:bg-orange-400 animate-pulse ml-0.5" />
          )}
        </div>
      </div>
      
      <SourceModal 
        source={selectedSource}
        isOpen={isModalOpen}
        onClose={closeModal}
        onOpenInFile={onOpenInFile}
      />
    </>
  );
};