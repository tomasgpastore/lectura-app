import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ChatSource } from '../../types';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  sources?: ChatSource[];
  sourceMapping?: Record<number, ChatSource>;
  isStreaming?: boolean;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
  slides?: Array<{ id: string; originalFileName: string }>;
}

interface SourceModalProps {
  source: ChatSource | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
  slides?: Array<{ id: string; originalFileName: string }>;
}

const SourceModal: React.FC<SourceModalProps> = ({ source, isOpen, onClose, onOpenInFile, slides = [] }) => {
  if (!isOpen || !source) return null;

  // Find the corresponding slide to get the original filename
  const slide = slides.find(s => s.id === source.slide_id);
  const fileName = slide?.originalFileName || source.s3_file_name;

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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">File:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">{fileName}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Pages:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {source.page_start === source.page_end ? source.page_start : `${source.page_start}-${source.page_end}`}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-gray-900 dark:text-white bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                  {source.raw_text}
                </div>
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

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({ 
  content, 
  sources = [], 
  sourceMapping = {},
  isStreaming = false,
  onOpenInFile,
  slides = []
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

  // Function to process text and convert citations to buttons
  const processTextForCitations = (text: string): React.ReactNode[] => {
    // First handle cursor marker
    const hasCursor = text.includes('⟨CURSOR⟩');
    const cleanText = text.replace('⟨CURSOR⟩', '');
    
    // Updated regex to handle both single citations [^1], multiple citations [^1, ^2, ^3], and [^Current Page]
    const citationRegex = /\[\^([0-9, ]+|Current Page)\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(cleanText))) {
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(cleanText.slice(lastIndex, match.index));
      }

      // Parse multiple source numbers from the match
      const sourceNumbersStr = match[1];
      
      // Handle [^Current Page] special case
      if (sourceNumbersStr === 'Current Page') {
        const currentPageButton = (
          <button
            key={`citation-current-page-${match!.index}`}
            className="inline-flex items-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 rounded transition-colors cursor-pointer border border-blue-200 dark:border-blue-700"
            title="Current Page"
          >
            Current Page
          </button>
        );
        parts.push(currentPageButton);
      } else {
        const sourceNumbers = sourceNumbersStr.split(',').map(num => parseInt(num.trim())).filter(num => !isNaN(num));
        
        // Create buttons for each source number
        const citationButtons = sourceNumbers.map((sourceNumber, index) => (
          <button
            key={`citation-${sourceNumber}-${match!.index}-${index}`}
            onClick={() => handleSourceClick(sourceNumber)}
            className="inline-flex items-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 rounded transition-colors cursor-pointer border border-orange-200 dark:border-orange-700"
            title={`View source ${sourceNumber}`}
          >
            {sourceNumber}
          </button>
        ));
        parts.push(...citationButtons);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < cleanText.length) {
      parts.push(cleanText.slice(lastIndex));
    }

    // Add cursor at the end if it was in the original text
    if (hasCursor) {
      parts.push(
        <span key="cursor" className="inline-block w-0.5 h-4 bg-orange-600 dark:bg-orange-400 animate-pulse ml-0.5" style={{ verticalAlign: 'baseline' }} />
      );
    }

    // If no citations found, return original text as array
    return parts.length === 0 ? [cleanText] : parts;
  };

  // Process content and add cursor at the end if streaming
  const processedContent = useMemo(() => {
    if (isStreaming && content) {
      // Add a special marker at the end that we can replace with cursor
      return content + '⟨CURSOR⟩';
    }
    return content;
  }, [content, isStreaming]);

  // Custom components for react-markdown
  const components = {
    // Handle paragraphs to process citations properly
    p: ({ children }: { children: React.ReactNode }) => {
      return (
        <p className="mb-4">
          {React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              return processTextForCitations(child);
            }
            return child;
          })}
        </p>
      );
    },
    
    // Style code blocks
    code: ({ className, children, ...rest }: { className?: string; children: React.ReactNode }) => {
      return (
        <code
          className={`${className || ''} bg-gray-100 dark:bg-neutral-700 px-2 py-1 rounded text-sm font-mono`}
          {...rest}
        >
          {children}
        </code>
      );
    },
    
    // Style pre blocks (code blocks)
    pre: ({ children }: { children: React.ReactNode }) => {
      return (
        <pre className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg overflow-x-auto">
          {children}
        </pre>
      );
    },
    
    // Style links
    a: ({ href, children, ...rest }: { href?: string; children: React.ReactNode }) => {
      return (
        <a
          href={href}
          className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 underline"
          target="_blank"
          rel="noopener noreferrer"
          {...rest}
        >
          {children}
        </a>
      );
    },
    
    // Style blockquotes
    blockquote: ({ children }: { children: React.ReactNode }) => {
      return (
        <blockquote className="border-l-4 border-orange-200 dark:border-orange-800 pl-4 italic text-gray-700 dark:text-gray-300">
          {children}
        </blockquote>
      );
    },
  };

  return (
    <>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <div className="leading-relaxed text-gray-900 dark:text-gray-100">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={components}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      </div>
      
      <SourceModal 
        source={selectedSource}
        isOpen={isModalOpen}
        onClose={closeModal}
        onOpenInFile={onOpenInFile}
        slides={slides}
      />
    </>
  );
});