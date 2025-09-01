import React, { useState, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Copy, Check, Globe, FileText } from 'lucide-react';
import { ChatSource } from '../../types';
import { WebSourceModal } from './WebSourceModal';
import { RagSourceModal } from './RagSourceModal';
import { PageSourceModal } from './PageSourceModal';
import { useCitationContext } from '../../contexts/CitationContext';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  sources?: ChatSource[];
  sourceMapping?: Record<string, ChatSource>;
  isStreaming?: boolean;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
  slides?: Array<{ id: string; originalFileName: string }>;
}


// Move helper functions outside component to prevent recreation
const createCitationButtons = (citations: { num: number; isWeb: boolean }[], groupId: number, expandedCitations: Set<string> = new Set()): string => {
  if (citations.length <= 2) {
    // Show all buttons if 2 or fewer
    return citations.map(({ num, isWeb }) => {
      const colorClasses = isWeb 
        ? 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700'
        : 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700';
      const webIcon = '<svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
      const fileIcon = '<svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
      const icon = isWeb ? webIcon : fileIcon;
      const content = `${icon}${num}`;
      return `<button class="inline-flex items-center justify-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium ${colorClasses} rounded transition-colors cursor-pointer border" style="min-height: 22px; line-height: 1;" title="View ${isWeb ? 'web' : ''} source ${num}" data-source="${num}" data-web="${isWeb}">${content}</button>`;
    }).join('');
  } else {
    // Show first 2 + ellipsis + hidden ones
    const visibleButtons = citations.slice(0, 2).map(({ num, isWeb }) => {
      const colorClasses = isWeb 
        ? 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700'
        : 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700';
      const webIcon = '<svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
      const fileIcon = '<svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
      const icon = isWeb ? webIcon : fileIcon;
      const content = `${icon}${num}`;
      return `<button class="inline-flex items-center justify-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium ${colorClasses} rounded transition-colors cursor-pointer border" style="min-height: 22px; line-height: 1;" title="View ${isWeb ? 'web' : ''} source ${num}" data-source="${num}" data-web="${isWeb}">${content}</button>`;
    }).join('');
    
    const hiddenButtons = citations.slice(2).map(({ num, isWeb }) => {
      const colorClasses = isWeb 
        ? 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700'
        : 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700';
      const webIcon = '<svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
      const fileIcon = '<svg class="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
      const icon = isWeb ? webIcon : fileIcon;
      return `<button class="citation-hidden-${groupId} inline-flex items-center justify-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium ${colorClasses} rounded transition-colors cursor-pointer border" style="display: none; min-height: 22px; line-height: 1;" title="View ${isWeb ? 'web' : ''} source ${num}" data-source="${num}" data-web="${isWeb}">${icon}${num}</button>`;
    }).join('');
    
    const ellipsisButton = `<button class="citation-ellipsis-${groupId} inline-flex items-center justify-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors cursor-pointer border border-gray-300 dark:border-gray-600" style="min-height: 22px; line-height: 1;" data-citation-group="${groupId}">...</button>`;
    
    return `<span class="citation-group" data-citation-index="${groupId}">${visibleButtons}${ellipsisButton}${hiddenButtons}</span>`;
  }
};

// Pre-process markdown content to convert citations to HTML
const preprocessMarkdownForCitations = (markdown: string, expandedCitations: Set<string> = new Set()): string => {
  // First, fix malformed citations like [^1, ^2] or {^1, ^2}
  const malformedCitationRegex = /\[\^([0-9, ^]+|Current page|Page)\]|\{\^([0-9, ^]+)\}/g;
  
  const fixedMarkdown = markdown.replace(malformedCitationRegex, (match, group1, group2) => {
    if (group1 === 'Current Page' || group1 === 'Current page' || group1 === 'Page') {
      return '[^Page]';
    }
    
    const isWebCitation = !!group2;
    const sourceStr = group1 || group2;
    
    // Extract numbers from malformed citations like "1, ^2, ^3"
    const numbers = sourceStr.match(/\d+/g) || [];
    
    if (numbers.length === 0) return match;
    
    // Convert to properly formatted individual citations
    return numbers.map((num: string) => isWebCitation ? `{^${num}}` : `[^${num}]`).join('');
  });
  
  const singleCitationRegex = /\[\^(\d+|Current Page|Page)\]|\{\^(\d+)\}/g;
  let citationGroupId = 0;
  
  // Process the fixed markdown to group consecutive citations
  let result = '';
  let lastIndex = 0;
  let consecutiveCitations: { num: number; isWeb: boolean }[] = [];
  
  // Find all matches in the fixed markdown
  const matches = Array.from(fixedMarkdown.matchAll(singleCitationRegex));
  
  matches.forEach((match) => {
    const startPos = match.index!;
    const endPos = startPos + match[0].length;
    const sourceNum = match[1] || match[2]; // match[1] for [^x], match[2] for {^x}
    const isWebCitation = !!match[2]; // True if it's a {^x} pattern
    
    // Check if there's any text between the last citation and this one
    const textBetween = fixedMarkdown.slice(lastIndex, startPos);
    
    // If there's any non-whitespace text between citations, flush the collected ones
    if (textBetween.trim().length > 0) {
      // Flush any collected citations first
      if (consecutiveCitations.length > 0) {
        result += createCitationButtons(consecutiveCitations, citationGroupId++, expandedCitations);
        consecutiveCitations = [];
      }
      result += textBetween;
    } else if (startPos > lastIndex) {
      // Just whitespace between citations, keep it but continue collecting
      result += textBetween;
    }
    
    // Handle Page citation specially
    if (sourceNum === 'Current Page' || sourceNum === 'Page') {
      // Flush any collected citations first
      if (consecutiveCitations.length > 0) {
        result += createCitationButtons(consecutiveCitations, citationGroupId++, expandedCitations);
        consecutiveCitations = [];
      }
      result += `<button class="inline-flex items-center px-1.5 py-0.5 ml-0.5 mr-0.5 text-xs font-medium bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 rounded transition-colors cursor-pointer border border-orange-200 dark:border-orange-700" title="Page" data-source="page" data-page="true">Page</button>`;
    } else {
      // Collect numeric citations with their type
      consecutiveCitations.push({ num: parseInt(sourceNum), isWeb: isWebCitation });
    }
    
    lastIndex = endPos;
  });
  
  // Add remaining text and flush any remaining citations
  if (consecutiveCitations.length > 0) {
    result += createCitationButtons(consecutiveCitations, citationGroupId++, expandedCitations);
  }
  if (lastIndex < fixedMarkdown.length) {
    result += fixedMarkdown.slice(lastIndex);
  }
  
  return result;
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
  const [isWebModalOpen, setIsWebModalOpen] = useState(false);
  const [isPageModalOpen, setIsPageModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { expandedCitations, toggleCitation } = useCitationContext();
  const [selectedWebSource, setSelectedWebSource] = useState<ChatSource | null>(null);
  const [selectedPageSource, setSelectedPageSource] = useState<ChatSource | null>(null);

  const handleSourceClick = (sourceNumber: number, isWebSource: boolean = false, isPageSource: boolean = false) => {
    if (isPageSource) {
      // Handle page citation
      const pageSource = sourceMapping['page'] || sources.find(s => s.id === 'page');
      if (pageSource) {
        setSelectedPageSource(pageSource);
        setIsPageModalOpen(true);
      }
    } else {
      // Try to get source from mapping first, then fallback to array
      const source = sourceMapping[sourceNumber.toString()] || sources[sourceNumber - 1];
      if (source) {
        if (isWebSource || source.type === 'web') {
          setSelectedWebSource(source);
          setIsWebModalOpen(true);
        } else if (source.type === 'page') {
          setSelectedPageSource(source);
          setIsPageModalOpen(true);
        } else {
          setSelectedSource(source);
          setIsModalOpen(true);
        }
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSource(null);
  };

  const closeWebModal = () => {
    setIsWebModalOpen(false);
    setSelectedWebSource(null);
  };

  const closePageModal = () => {
    setIsPageModalOpen(false);
    setSelectedPageSource(null);
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


  // Memoize the processTextForCursor function to prevent recreation
  const processTextForCursor = useCallback((text: string): React.ReactNode[] => {
    // Only handle cursor marker, not citations (citations are pre-processed)
    const hasCursor = text.includes('⟨CURSOR⟩');
    
    if (!hasCursor) {
      return [text];
    }
    
    const parts = text.split('⟨CURSOR⟩');
    const result: React.ReactNode[] = [];
    
    parts.forEach((part, index) => {
      if (part) {
        result.push(part);
      }
      // Add cursor after each part except the last
      if (index < parts.length - 1) {
        result.push(
          <span key={`cursor-${index}`} className="inline-block w-0.5 h-4 bg-orange-600 dark:bg-orange-400 animate-pulse ml-0.5" style={{ verticalAlign: 'baseline' }} />
        );
      }
    });
    
    return result;
  }, []);

  // Process content and add cursor at the end if streaming
  const processedContent = useMemo(() => {
    let processed = content;
    
    // Pre-process citations in the entire markdown content
    processed = preprocessMarkdownForCitations(processed, expandedCitations);
    
    // Clean up any existing cursor markers first
    processed = processed.replace(/⟨CURSOR⟩/g, '');
    
    if (isStreaming && processed) {
      // Add a special marker at the end that we can replace with cursor
      processed = processed + '⟨CURSOR⟩';
    }
    
    return processed;
  }, [content, isStreaming, expandedCitations]);


  // Custom components for react-markdown
  const components = {
    // Handle button clicks for citations
    button: (props: JSX.IntrinsicElements['button'] & { node?: unknown; 'data-source'?: string; 'data-web'?: string; 'data-page'?: string; 'data-citation-group'?: string; 'data-hidden-count'?: string; className?: string }) => {
      const { children, className, ...rest } = props;
      const dataSource = props['data-source'];
      const isWebSource = props['data-web'] === 'true';
      const isPageSource = props['data-page'] === 'true';
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
            onClick={() => toggleCitation(citationGroup)}
          >
            {isExpanded ? '><' : '...'}
          </button>
        );
      }
      
      // Handle hidden citation buttons
      if (className?.includes('citation-hidden-')) {
        const groupMatch = className.match(/citation-hidden-(\d+)/);
        if (groupMatch) {
          const groupId = groupMatch[1];
          const isExpanded = expandedCitations.has(groupId);
          return (
            <button
              {...rest}
              className={className}
              style={{ display: isExpanded ? 'inline-flex' : 'none' }}
              onClick={() => handleSourceClick(parseInt(dataSource!), isWebSource)}
            >
              {children}
            </button>
          );
        }
      }
      
      // Handle source button clicks
      if (dataSource) {
        return (
          <button
            {...rest}
            className={className}
            onClick={() => {
              if (isPageSource || dataSource === 'page') {
                handleSourceClick(0, false, true);
              } else {
                handleSourceClick(parseInt(dataSource), isWebSource);
              }
            }}
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
              return processTextForCursor(child);
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
        return <>{processTextForCursor(children)}</>;
      }
      return <>{children}</>;
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
      
      <RagSourceModal 
        source={selectedSource}
        isOpen={isModalOpen}
        onClose={closeModal}
        onOpenInFile={onOpenInFile}
        slides={slides}
      />
      
      <WebSourceModal
        source={selectedWebSource}
        isOpen={isWebModalOpen}
        onClose={closeWebModal}
      />
      
      <PageSourceModal
        source={selectedPageSource}
        isOpen={isPageModalOpen}
        onClose={closePageModal}
        onOpenInFile={(slideId, pageNumber) => {
          if (onOpenInFile && slides) {
            // Find slide to get s3file path
            const slide = slides.find(s => s.id === slideId);
            if (slide) {
              // Use the s3file format expected by DocumentPreview
              const s3file = `courses/${slideId}/slides/${slideId}.pdf`;
              onOpenInFile(s3file, pageNumber, '');
            }
          }
        }}
        slides={slides}
      />
    </>
  );
});