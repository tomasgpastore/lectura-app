import React, { useRef, memo, useCallback } from 'react';
import { ChatMessageUI, Course } from '../../types';
import { ChatInterface } from './ChatInterface';
import { ChatInputStandalone, ChatInputStandaloneHandle } from './ChatInputStandalone';
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
  onSubmit: (message: string) => void;
  
  // Optional features
  selectedTextForChat?: string;
  onClearSelectedText?: () => void;
  isPdfPreviewOpen?: boolean;
  
  // Indicator items callback for parent to know what's selected
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
}) => {
  const chatInputRef = useRef<ChatInputStandaloneHandle>(null);

  // Handle message submission with indicator items
  const handleSendMessage = useCallback((message: string, indicatorItems: IndicatorItem[]) => {
    // Notify parent about indicator items if needed
    onIndicatorItemsChange?.(indicatorItems);
    
    // Submit the message
    onSubmit(message);
  }, [onSubmit, onIndicatorItemsChange]);

  // Wrap onSubmit for ChatInterface compatibility
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // This is just for compatibility - actual submission happens through ChatInputStandalone
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
      <ChatInputStandalone
        ref={chatInputRef}
        onSendMessage={handleSendMessage}
        isAiLoading={isAiLoading}
        selectedTextForChat={selectedTextForChat}
        onClearSelectedText={onClearSelectedText}
        isPdfPreviewOpen={isPdfPreviewOpen}
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
      />
    </div>
  );
});

ChatContainer.displayName = 'ChatContainer';