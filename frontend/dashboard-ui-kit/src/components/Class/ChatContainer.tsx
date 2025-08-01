import React, { useRef, memo, useCallback } from 'react';
import { ChatMessageUI, Course } from '../../types';
import { ChatInterface } from './ChatInterface';
import { ChatInput, ChatInputHandle } from './ChatInput';
import { IndicatorItem } from './IndicatorsList';

interface Document {
  id: string;
  name: string;
}

interface ChatContainerProps {
  // Chat Interface props
  messages: ChatMessageUI[];
  isAiLoading: boolean;
  onClearChat: () => void;
  streamingMessageIds: Set<string>;
  onOpenInFile?: (s3FileName: string, pageStart: number, rawText: string) => void;
  slides?: Array<{ id: string; originalFileName: string }>;
  
  // Chat submission
  onSubmit: (message: string, isDocsSearchEnabled?: boolean, isWebSearchEnabled?: boolean) => void;
  
  // Optional features
  selectedTextForChat?: string;
  onClearSelectedText?: () => void;
  isPdfPreviewOpen?: boolean;
  
  // Indicator items - controlled from parent
  indicatorItems?: IndicatorItem[];
  onIndicatorItemsChange?: (items: IndicatorItem[]) => void;
  
  // Data for suggestions
  courses?: Course[];
  documents?: Document[];
  
  // Command callbacks
  onOpenDocument?: (documentId: string) => void;
  onRemoveDocument?: (documentId: string) => void;
  onRenameDocument?: (documentId: string, newName: string) => void;
  onFilesUploaded?: (files: File[]) => void;
  onSaveCurrentState?: () => void;
  
  // Controlled input props
  value?: string;
  onValueChange?: (value: string) => void;
  
  // Controlled search button states
  docsSearchEnabled?: boolean;
  onDocsSearchEnabledChange?: (enabled: boolean) => void;
  webSearchEnabled?: boolean;
  onWebSearchEnabledChange?: (enabled: boolean) => void;
}

export const ChatContainer = memo<ChatContainerProps>(({
  // Chat Interface props
  messages,
  isAiLoading,
  onClearChat,
  streamingMessageIds,
  onOpenInFile,
  slides = [],
  
  // Chat submission
  onSubmit,
  selectedTextForChat,
  onClearSelectedText,
  isPdfPreviewOpen,
  indicatorItems,
  onIndicatorItemsChange,
  courses = [],
  documents = [],
  onOpenDocument,
  onRemoveDocument,
  onRenameDocument,
  onFilesUploaded,
  onSaveCurrentState,
  value,
  onValueChange,
  docsSearchEnabled,
  onDocsSearchEnabledChange,
  webSearchEnabled,
  onWebSearchEnabledChange,
}) => {
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Handle message submission with indicator items
  const handleSendMessage = useCallback((message: string, indicatorItems: IndicatorItem[], isDocsSearchEnabled: boolean, isWebSearchEnabled: boolean) => {
    // Notify parent about indicator items if needed
    onIndicatorItemsChange?.(indicatorItems);
    
    // Submit the message with search states
    onSubmit(message, isDocsSearchEnabled, isWebSearchEnabled);
  }, [onSubmit, onIndicatorItemsChange]);

  // Wrap onSubmit for ChatInterface compatibility
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // This is just for compatibility - actual submission happens through ChatInput
  }, []);

  return (
    <div className="bg-white dark:bg-neutral-800 dark:border-neutral-700 rounded-xl border flex flex-col h-full relative">
      {/* Chat Interface - takes full height */}
      <ChatInterface
        messages={messages}
        isAiLoading={isAiLoading}
        onSubmit={handleSubmit}
        onClearChat={onClearChat}
        streamingMessageIds={streamingMessageIds}
        onOpenInFile={onOpenInFile}
        slides={slides}
      />
      
      {/* Chat Input - sticky at bottom */}
      <ChatInput
        ref={chatInputRef}
        onSendMessage={handleSendMessage}
        isAiLoading={isAiLoading}
        selectedTextForChat={selectedTextForChat}
        onClearSelectedText={onClearSelectedText}
        isPdfPreviewOpen={isPdfPreviewOpen}
        indicatorItems={indicatorItems}
        onIndicatorItemsChange={onIndicatorItemsChange}
        files={slides?.map(slide => ({
          id: slide.id,
          name: slide.originalFileName,
          type: 'PDF'
        })) || []}
        courses={courses}
        documents={documents}
        onClearChat={onClearChat}
        onOpenDocument={onOpenDocument}
        onRemoveDocument={onRemoveDocument}
        onRenameDocument={onRenameDocument}
        onFilesUploaded={onFilesUploaded}
        onSaveCurrentState={onSaveCurrentState}
        value={value}
        onValueChange={onValueChange}
        docsSearchEnabled={docsSearchEnabled}
        onDocsSearchEnabledChange={onDocsSearchEnabledChange}
        webSearchEnabled={webSearchEnabled}
        onWebSearchEnabledChange={onWebSearchEnabledChange}
      />
    </div>
  );
});

ChatContainer.displayName = 'ChatContainer';