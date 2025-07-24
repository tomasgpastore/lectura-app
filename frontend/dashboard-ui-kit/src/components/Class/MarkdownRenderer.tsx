import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Copy, Check } from 'lucide-react';
import { ChatSource } from '../../types';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  sources?: ChatSource[];
  sourceMapping?: Record<string, ChatSource>;
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
  const slide = slides.find(s => s.id === source.slide);
  const fileName = slide?.originalFileName || "Not Found";

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
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
                    {source.start === source.end ? source.start : `${source.start}-${source.end}`}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-gray-900 dark:text-white bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                  {source.text}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-neutral-700">
              <button
                onClick={() => {
                  if (onOpenInFile) {
                    onOpenInFile(source.s3file, parseInt(source.start), source.text);
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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());

  const handleSourceClick = (sourceNumber: number) => {
    // Try to get source from mapping first, then fallback to array
    const source = sourceMapping[sourceNumber.toString()] || sources[sourceNumber - 1];
    if (source) {
      setSelectedSource(source);
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSource(null);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  // Function to process text and convert citations to buttons
  const processTextForCitations = (text: string): React.ReactNode[] => {
    // First handle cursor marker
    const hasCursor = text.includes('⟨CURSOR⟩');
    const cleanText = text.replace(/⟨CURSOR⟩/g, '');
    
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
            className="inline-flex items-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 rounded transition-colors cursor-pointer border border-orange-200 dark:border-orange-700"
            title="Current page"
          >
            Current page
          </button>
        );
        parts.push(currentPageButton);
      } else {
        const sourceNumbers = sourceNumbersStr.split(',').map(num => parseInt(num.trim())).filter(num => !isNaN(num));
        const citationGroupKey = `${match!.index}`;
        const isExpanded = expandedCitations.has(citationGroupKey);
        
        if (sourceNumbers.length > 3) {
          // Show only first 2 sources + ellipsis button when collapsed
          const visibleSources = isExpanded ? sourceNumbers : sourceNumbers.slice(0, 2);
          
          // Create buttons for visible source numbers
          const citationButtons = visibleSources.map((sourceNumber, index) => (
            <button
              key={`citation-${sourceNumber}-${match!.index}-${index}`}
              onClick={() => handleSourceClick(sourceNumber)}
              className="inline-flex items-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 rounded transition-colors cursor-pointer border border-orange-200 dark:border-orange-700"
              title={`View source ${sourceNumber}`}
            >
              {sourceNumber}
            </button>
          ));
          
          // Add ellipsis button
          const ellipsisButton = (
            <button
              key={`citation-ellipsis-${match!.index}`}
              onClick={() => {
                const newExpanded = new Set(expandedCitations);
                if (isExpanded) {
                  newExpanded.delete(citationGroupKey);
                } else {
                  newExpanded.add(citationGroupKey);
                }
                setExpandedCitations(newExpanded);
              }}
              className="inline-flex items-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors cursor-pointer border border-gray-300 dark:border-gray-600"
              title={isExpanded ? "Show less" : `Show ${sourceNumbers.length - 2} more`}
            >
              {isExpanded ? '−' : '...'}
            </button>
          );
          
          parts.push(...citationButtons, ellipsisButton);
        } else {
          // Show all sources if 3 or fewer
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

  // Pre-process markdown content to convert citations to HTML
  const preprocessMarkdownForCitations = (markdown: string): string => {
    // First, let's convert the markdown to handle individual citations
    // This regex matches [^1], [^2], etc. individually
    const singleCitationRegex = /\[\^(\d+|Current page)\]/g;
    let citationGroupId = 0;
    
    // Process the text to group consecutive citations
    let processed = markdown;
    let result = '';
    let lastIndex = 0;
    let consecutiveCitations: number[] = [];
    let isCollectingCitations = false;
    
    // Find all matches
    const matches = Array.from(processed.matchAll(singleCitationRegex));
    
    matches.forEach((match, index) => {
      const startPos = match.index!;
      const endPos = startPos + match[0].length;
      const sourceNum = match[1];
      
      // Add text before this citation
      if (startPos > lastIndex) {
        // If we have collected citations and now hit text, flush them
        if (consecutiveCitations.length > 0) {
          result += createCitationButtons(consecutiveCitations, citationGroupId++);
          consecutiveCitations = [];
        }
        result += processed.slice(lastIndex, startPos);
      }
      
      // Handle Current Page specially
      if (sourceNum === 'Current Page') {
        // Flush any collected citations first
        if (consecutiveCitations.length > 0) {
          result += createCitationButtons(consecutiveCitations, citationGroupId++);
          consecutiveCitations = [];
        }
        result += `<button class="inline-flex items-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 rounded transition-colors cursor-pointer border border-orange-200 dark:border-orange-700" title="Current Page">Current Page</button>`;
      } else {
        // Collect numeric citations
        consecutiveCitations.push(parseInt(sourceNum));
      }
      
      lastIndex = endPos;
    });
    
    // Add remaining text and flush any remaining citations
    if (consecutiveCitations.length > 0) {
      result += createCitationButtons(consecutiveCitations, citationGroupId++);
    }
    if (lastIndex < processed.length) {
      result += processed.slice(lastIndex);
    }
    
    return result;
  };
  
  // Helper function to create citation buttons
  const createCitationButtons = (sourceNumbers: number[], groupId: number): string => {
    if (sourceNumbers.length <= 2) {
      // Show all buttons if 2 or fewer
      return sourceNumbers.map(num => 
        `<button class="inline-flex items-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 rounded transition-colors cursor-pointer border border-orange-200 dark:border-orange-700" title="View source ${num}" data-source="${num}">${num}</button>`
      ).join('');
    } else {
      // Show first 2 + ellipsis + hidden ones
      const visibleButtons = sourceNumbers.slice(0, 2).map(num => 
        `<button class="inline-flex items-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 rounded transition-colors cursor-pointer border border-orange-200 dark:border-orange-700" title="View source ${num}" data-source="${num}">${num}</button>`
      ).join('');
      
      const hiddenButtons = sourceNumbers.slice(2).map(num => 
        `<button class="citation-hidden-${groupId} inline-flex items-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 rounded transition-colors cursor-pointer border border-orange-200 dark:border-orange-700" style="display: none;" title="View source ${num}" data-source="${num}">${num}</button>`
      ).join('');
      
      const ellipsisButton = `<button class="citation-ellipsis-${groupId} inline-flex items-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors cursor-pointer border border-gray-300 dark:border-gray-600" data-citation-group="${groupId}">...</button>`;
      
      return `<span class="citation-group" data-citation-index="${groupId}">${visibleButtons}${ellipsisButton}${hiddenButtons}</span>`;
    }
  };

  // Process content and add cursor at the end if streaming
  const processedContent = useMemo(() => {
    let processed = content;
    
    // Pre-process citations in the entire markdown content
    processed = preprocessMarkdownForCitations(processed);
    
    // Clean up any existing cursor markers first
    processed = processed.replace(/⟨CURSOR⟩/g, '');
    
    if (isStreaming && processed) {
      // Add a special marker at the end that we can replace with cursor
      processed = processed + '⟨CURSOR⟩';
    }
    
    return processed;
  }, [content, isStreaming]);

  // Custom components for react-markdown
  const components = {
    // Handle button clicks for citations
    button: (props: JSX.IntrinsicElements['button'] & { node?: unknown; 'data-source'?: string; 'data-citation-group'?: string; 'data-hidden-count'?: string; className?: string }) => {
      const { children, className, ...rest } = props;
      const dataSource = props['data-source'];
      const citationGroup = props['data-citation-group'];
      
      // Handle ellipsis button clicks
      if (className?.includes('citation-ellipsis') && citationGroup) {
        const isExpanded = expandedCitations.has(citationGroup);
        return (
          <button
            {...rest}
            className={isExpanded 
              ? className?.replace('rounded', 'rounded-full px-2') 
              : className
            }
            onClick={() => {
              const newExpanded = new Set(expandedCitations);
              const shouldExpand = !isExpanded;
              
              if (shouldExpand) {
                newExpanded.add(citationGroup);
              } else {
                newExpanded.delete(citationGroup);
              }
              
              // Use a slight delay to ensure DOM is ready
              setTimeout(() => {
                const hiddenButtons = document.querySelectorAll(`.citation-hidden-${citationGroup}`);
                
                hiddenButtons.forEach(btn => {
                  (btn as HTMLElement).style.display = shouldExpand ? 'inline-flex' : 'none';
                });
              }, 0);
              
              setExpandedCitations(newExpanded);
            }}
          >
            {isExpanded ? '><' : children}
          </button>
        );
      }
      
      // Handle source button clicks
      if (dataSource) {
        return (
          <button
            {...rest}
            className={className}
            onClick={() => handleSourceClick(parseInt(dataSource))}
          >
            {children}
          </button>
        );
      }
      
      return <button {...rest} className={className}>{children}</button>;
    },
    // Keep paragraph processing for cursor handling
    p: (props: JSX.IntrinsicElements['p'] & { node?: unknown }) => {
      const { children, ...rest } = props;
      return (
        <p {...rest}>
          {React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              return processTextForCitations(child);
            }
            return child;
          })}
        </p>
      );
    },
    // Handle text nodes that might contain cursor markers
    text: (props: { children?: unknown }) => {
      const { children } = props;
      if (typeof children === 'string') {
        return processTextForCitations(children);
      }
      return children;
    },
    // Add copy button to code blocks
    pre: ({ children, ...props }: JSX.IntrinsicElements['pre'] & { node?: unknown }) => {
      const codeElement = React.Children.toArray(children).find(
        (child: unknown) => React.isValidElement(child) && child?.type === 'code'
      );
      const codeString = React.isValidElement(codeElement) ? codeElement?.props?.children || '' : '';
      
      return (
        <div className="relative group">
          <button
            onClick={() => handleCopyCode(codeString)}
            className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors opacity-0 group-hover:opacity-100 z-10"
            title="Copy code"
          >
            {copiedCode === codeString ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <pre {...props}>
            {children}
          </pre>
        </div>
      );
    },
  };

  return (
    <>
      <div className="prose prose-base max-w-none dark:prose-invert 
                      prose-a:text-orange-600 prose-a:dark:text-orange-400 
                      prose-a:hover:text-orange-700 prose-a:dark:hover:text-orange-300
                      prose-blockquote:border-orange-200 prose-blockquote:dark:border-orange-800
                      prose-p:text-base prose-p:leading-relaxed prose-p:text-gray-900 prose-p:dark:text-white
                      prose-li:text-base prose-li:leading-relaxed prose-li:text-gray-900 prose-li:dark:text-white
                      prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                      prose-h1:text-gray-900 prose-h1:dark:text-white prose-h2:text-gray-900 prose-h2:dark:text-white prose-h3:text-gray-900 prose-h3:dark:text-white
                      prose-strong:text-base prose-em:text-base
                      prose-strong:text-gray-900 prose-strong:dark:text-white prose-em:text-gray-900 prose-em:dark:text-white
                      prose-code:bg-gray-100 prose-code:dark:bg-neutral-700
                      prose-code:text-gray-900 prose-code:dark:text-white
                      prose-code:text-sm prose-code:font-mono
                      prose-pre:bg-gray-100 prose-pre:dark:bg-neutral-700
                      prose-pre:text-gray-900 prose-pre:dark:text-white
                      prose-pre:text-sm
                      [&>*]:text-base [&>*]:text-gray-900 [&>*]:dark:text-white">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeRaw]}
          components={components}
        >
          {processedContent}
        </ReactMarkdown>
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