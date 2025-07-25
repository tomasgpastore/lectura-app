import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';

const Chatbot = () => {
  const [conversationGroups, setConversationGroups] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypingText, setCurrentTypingText] = useState('');
  const [containerHeight, setContainerHeight] = useState(0);
  
  const messagesContainerRef = useRef(null);
  const activeGroupRef = useRef(null);

  // Simular respuesta del bot
  const simulateBotResponse = useCallback(() => {
    const botResponses = [
      "Esta es una respuesta corta del bot.",
      "Esta es una respuesta un poco más larga que demuestra cómo funciona el scroll automático cuando el contenido empieza a crecer dentro del grupo.",
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Esta es una respuesta muy larga que definitivamente hará que el grupo necesite scroll interno.",
      "Aquí hay otra respuesta. ".repeat(50) + "Este texto se repite muchas veces para demostrar el scroll.",
    ];
    
    return botResponses[Math.floor(Math.random() * botResponses.length)];
  }, []);

  // Efecto máquina de escribir
  const typewriterEffect = useCallback((text, groupId, callback) => {
    let index = 0;
    setCurrentTypingText('');
    setIsTyping(true);
    
    const interval = setInterval(() => {
      if (index < text.length) {
        setCurrentTypingText((prev) => prev + text[index]);
        index++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
        callback(text);
      }
    }, 30);
    
    return () => clearInterval(interval);
  }, []);

  // Actualizar altura del contenedor
  useEffect(() => {
    const updateHeight = () => {
      if (messagesContainerRef.current) {
        setContainerHeight(messagesContainerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Scroll al grupo activo cuando se crea uno nuevo
  useEffect(() => {
    if (activeGroupRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const activeGroup = activeGroupRef.current;
      
      // Scroll suave al nuevo grupo
      activeGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [conversationGroups.length]);

  // Auto-scroll mientras se escribe en el último grupo
  useEffect(() => {
    if (isTyping && activeGroupRef.current) {
      const groupContent = activeGroupRef.current.querySelector('.group-content');
      if (groupContent && groupContent.scrollHeight > activeGroupRef.current.clientHeight) {
        groupContent.scrollTop = groupContent.scrollHeight;
      }
    }
  }, [currentTypingText, isTyping]);

  // Manejar el envío de mensajes
  const handleSendMessage = useCallback(() => {
    if (inputValue.trim() === '' || isTyping) return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const groupId = Date.now();
    
    // Crear nuevo grupo con la pregunta del usuario
    const newGroup = {
      id: groupId,
      userMessage: {
        text: inputValue,
        timestamp: timestamp
      },
      botMessage: null,
      isActive: true
    };
    
    // Marcar todos los grupos anteriores como inactivos
    setConversationGroups(prev => [
      ...prev.map(group => ({ ...group, isActive: false })),
      newGroup
    ]);
    setInputValue('');
    
    // Simular respuesta del bot
    setTimeout(() => {
      const botResponse = simulateBotResponse();
      typewriterEffect(botResponse, groupId, (fullText) => {
        setConversationGroups(prev => 
          prev.map(group => 
            group.id === groupId 
              ? { 
                  ...group, 
                  botMessage: {
                    text: fullText,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                }
              : group
          )
        );
        setCurrentTypingText('');
      });
    }, 500);
  }, [inputValue, isTyping, simulateBotResponse, typewriterEffect]);

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg flex flex-col h-full">
        {/* Header */}
        <div className="bg-blue-500 text-white p-4 rounded-t-lg">
          <h2 className="text-xl font-semibold">Chatbot con Grupos de Conversación</h2>
          <p className="text-sm opacity-90">
            {conversationGroups.length} grupo{conversationGroups.length !== 1 ? 's' : ''} de conversación
          </p>
        </div>
        
        {/* Contenedor de grupos */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto"
        >
          {conversationGroups.map((group, index) => {
            const isLastGroup = index === conversationGroups.length - 1;
            
            return (
              <div
                key={group.id}
                ref={isLastGroup ? activeGroupRef : null}
                className={`conversation-group relative ${isLastGroup ? 'overflow-hidden' : ''}`}
                style={{ 
                  minHeight: isLastGroup ? `${containerHeight}px` : 'auto',
                  height: isLastGroup ? `${containerHeight}px` : 'auto'
                }}
              >
                <div 
                  className={`group-content flex flex-col p-4 space-y-4 ${
                    isLastGroup ? 'h-full overflow-y-auto' : ''
                  }`}
                >
                  {/* Mensaje del usuario */}
                  <div className="flex justify-end">
                    <div className="max-w-[70%] bg-blue-500 text-white rounded-lg p-3">
                      <p className="whitespace-pre-wrap">{group.userMessage.text}</p>
                      <p className="text-xs mt-1 opacity-70">{group.userMessage.timestamp}</p>
                    </div>
                  </div>
                  
                  {/* Mensaje del bot */}
                  {group.botMessage && (
                    <div className="flex justify-start">
                      <div className="max-w-[70%] bg-gray-200 text-gray-800 rounded-lg p-3">
                        <p className="whitespace-pre-wrap">{group.botMessage.text}</p>
                        <p className="text-xs mt-1 opacity-70">{group.botMessage.timestamp}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Mensaje en proceso de escritura */}
                  {isLastGroup && isTyping && currentTypingText && (
                    <div className="flex justify-start">
                      <div className="max-w-[70%] bg-gray-200 text-gray-800 rounded-lg p-3">
                        <p className="whitespace-pre-wrap">{currentTypingText}</p>
                        <span className="inline-block w-2 h-4 bg-gray-600 animate-pulse ml-1" />
                      </div>
                    </div>
                  )}
                  
                  {/* Indicador de escritura */}
                  {isLastGroup && isTyping && !currentTypingText && (
                    <div className="flex justify-start">
                      <div className="bg-gray-200 rounded-lg p-3">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Separador entre grupos (solo para grupos anteriores) */}
                {!isLastGroup && (
                  <div className="border-b border-gray-200 mx-4"></div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Escribe tu mensaje..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isTyping}
            />
            <button
              onClick={handleSendMessage}
              disabled={isTyping || inputValue.trim() === ''}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;


/*
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Layout/Header';
import { 
  FileManager, 
  ChatContainer, 
  RemoveDocumentModal,
  EditDocumentModal,
  DeleteErrorModal
} from '../components/Class';
import { DocumentPreview } from '../components/Class/DocumentPreview';
import { useDocumentManager } from '../lib/hooks/useDocumentManager';
import { useChatManager } from '../lib/hooks/useChatManager';
import { courseApi, slideApi } from '../lib/api/api';

// Memoized components to prevent unnecessary re-renders
const MemoizedChatContainer = React.memo(ChatContainer);
const MemoizedFileManager = React.memo(FileManager);

export const Class: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isFileManagerCollapsed, setIsFileManagerCollapsed] = useState(false);
  const [selectedTextForChat, setSelectedTextForChat] = useState<string>('');
  const [chatIndicatorItems, setChatIndicatorItems] = useState<Array<{
    id: string;
    type: 'current-page' | 'document';
    name: string;
    removable: boolean;
  }>>([]);
  const [chatInputValue, setChatInputValue] = useState<string>('');


  // Fetch course data with better caching while ensuring data loads
  const { data: course, isLoading: courseLoading, error: courseError } = useQuery({
    queryKey: ['course', id],
    queryFn: () => courseApi.getById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  // Use fetched data primarily, with cache as fallback only for errors
  const displayCourse = course || queryClient.getQueryData(['course', id!]);

  // Fetch all slides for the course with better caching
  const { data: allSlides = [], isLoading: slidesLoading } = useQuery({
    queryKey: ['slides', id],
    queryFn: () => slideApi.getAll(id!),
    enabled: !!id && !!displayCourse,
    staleTime: 5 * 60 * 1000, // Consider slides fresh for 5 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
    refetchOnWindowFocus: false,
  });
  
  // Fetch all courses for the /cd command
  const { data: allCourses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseApi.getAll(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Custom hooks for functionality
  const documentManager = useDocumentManager(id, allSlides);
  // Extract document IDs from indicator items (only document type, not current-page)
  const priorityDocumentIds = chatIndicatorItems
    .filter(item => item.type === 'document')
    .map(item => item.id);
    
  const chatManager = useChatManager(id, documentManager.selectedDocument, priorityDocumentIds);


  // Handle opening file from source citation
  const handleOpenInFile = (s3FileName: string, pageStart: number) => {
    console.log(`Opening file: ${s3FileName}, page: ${pageStart}`);
    // Extract slide ID from s3_file_name (format: courses/{courseId}/slides/{slideId}.pdf)
    const slideIdMatch = s3FileName.match(/slides\/([^/]+)\.pdf$/);
    if (slideIdMatch) {
      const slideId = slideIdMatch[1];
      const slide = allSlides.find(s => s.id === slideId);
      if (slide) {
        console.log(`Found slide: ${slide.originalFileName}, navigating to page ${pageStart}`);
        
        // Check if this document is already selected
        const isAlreadySelected = documentManager.selectedDocument?.id === slide.id;
        
        if (isAlreadySelected) {
          console.log(`Document already selected, just changing page to ${pageStart}`);
          // Document is already open, just change the page
          documentManager.setCurrentPage(pageStart);
        } else {
          console.log(`Selecting new document and navigating to page ${pageStart}`);
          // Convert slide to document format and set as selected
          const document = {
            id: slide.id,
            name: slide.originalFileName,
            type: slide.contentType,
            size: slide.fileSize,
            uploadedAt: new Date(slide.uploadTimestamp),
          };
          documentManager.setSelectedDocument(document);
          documentManager.setCurrentPage(pageStart);
        }
      } else {
        console.log(`Slide not found for ID: ${slideId}`);
      }
    } else {
      console.log(`Invalid s3 file name format: ${s3FileName}`);
    }
  };

  // Set selected text for chat (new approach - for cloud popup)
  const setSelectedTextForChatHandler = (text: string) => {
    setSelectedTextForChat(text);
  };

  // Clear selected text
  const clearSelectedText = () => {
    setSelectedTextForChat('');
  };

  // Handle form submission with combined text
  const handleCombinedSubmit = (message: string) => {
    // The message already contains the selected text from ChatInputStandalone
    // so we don't need to add it again here
    const trimmedMessage = message.trim();
    
    if (trimmedMessage) {
      // Use the new method to send with custom message
      chatManager.handleSubmitWithMessage(trimmedMessage);
      
      // Clear both inputs
      chatManager.handleInputChange('');
      clearSelectedText();
      setChatInputValue('');
    }
  };

  // Show file management only when no document is previewed
  const showFileManagement = !documentManager.selectedDocument;

  // Debug logging in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Class component state:', {
        id,
        courseLoading,
        course: !!course,
        displayCourse: !!displayCourse,
        courseError: !!courseError,
        slidesLoading
      });
    }
  }, [id, courseLoading, course, displayCourse, courseError, slidesLoading]);

  // Determine if we're in a loading state - be more permissive
  const isPageLoading = courseLoading && !displayCourse;

  // Error state
  if (courseError && !displayCourse) {
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-lg text-red-600 dark:text-red-400">
          Failed to load course
        </div>
      </div>
    );
  }

  // Show loading state
  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600 dark:text-gray-400">Loading course...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-blue-50 dark:bg-neutral-900 flex flex-col">
      <Header 
        courseName={(displayCourse as { name?: string })?.name || 'Loading...'}
        courseCode={(displayCourse as { code?: string })?.code || ''}
        lightBlueTheme={true}
      />

      <style>
        {`
          /* Custom yellow scrollbar styles */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          ::-webkit-scrollbar-track {
            background: #f8f9fa;
            border-radius: 4px;
          }
          
          ::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #FFD700, #FFC700);
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, #FFC700, #FFB000);
          }

          /* Modern button styles */
          .modern-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 8px;
            color: white;
            padding: 8px 16px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
            margin: 0 4px;
          }
          
          .modern-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }
          
          .modern-btn:active {
            transform: translateY(0);
          }
          
          .modern-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }

        `}
      </style>

      {/* Main Layout - Full Screen with top padding for fixed header */}
      <div className="flex-1 flex pt-16 main-content-container min-h-0">
        {/* File Upload Section - only show when no document selected */}
        {showFileManagement && (
          <MemoizedFileManager
            documents={documentManager.documents}
            isLoading={slidesLoading}
            isCollapsed={isFileManagerCollapsed}
            onToggleCollapse={() => setIsFileManagerCollapsed(!isFileManagerCollapsed)}
            onFilesUploaded={documentManager.handleFilesUploaded}
            onPreviewDocument={documentManager.handlePreviewDocument}
            onDeleteConfirmation={documentManager.handleDeleteConfirmation}
            onEditDocument={documentManager.handleEditDocument}
          />
        )}

        {/* Document Preview Section - replace file upload when document is selected */}
        {documentManager.selectedDocument && (
          <div style={{ display: 'flex', height: '100%', width: '100%' }}>
            <DocumentPreview
              document={documentManager.selectedDocument}
              onClose={() => documentManager.setSelectedDocument(null)}
              onSetSelectedTextForChat={setSelectedTextForChatHandler}
              onPageChange={documentManager.setCurrentPage}
              initialPage={documentManager.currentPage}
              courseId={id}
            >
              <MemoizedChatContainer
                key="chat-interface"
                messages={chatManager.messages}
                isAiLoading={chatManager.isAiLoading}
                onSubmit={handleCombinedSubmit}
                onClearChat={chatManager.handleClearChat}
                streamingMessageIds={chatManager.streamingMessageIds}
                onOpenInFile={handleOpenInFile}
                slides={allSlides}
                selectedTextForChat={selectedTextForChat}
                onClearSelectedText={clearSelectedText}
                courses={allCourses}
                isPdfPreviewOpen={true}
                onIndicatorItemsChange={setChatIndicatorItems}
                documents={documentManager.documents}
                onOpenDocument={(documentId: string) => {
                  const doc = documentManager.documents.find(d => d.id === documentId);
                  if (doc) {
                    documentManager.handlePreviewDocument(doc);
                  }
                }}
                onRemoveDocument={(documentId: string) => {
                  const doc = documentManager.documents.find(d => d.id === documentId);
                  if (doc) {
                    documentManager.handleDeleteDocumentDirect(doc);
                  }
                }}
                onRenameDocument={async (documentId: string, newName: string) => {
                  const doc = documentManager.documents.find(d => d.id === documentId);
                  if (!doc) return;
                  
                  // Get the file extension from the original name
                  const fileExtension = doc.name.split('.').pop() || '';
                  
                  // Add the extension to the new name
                  const fullNewName = fileExtension ? `${newName}.${fileExtension}` : newName;
                  
                  // Check for duplicate names first
                  const existingDoc = documentManager.documents.find(
                    d => d.id !== doc.id && d.name.toLowerCase() === fullNewName.toLowerCase()
                  );
                  
                  if (existingDoc) {
                    alert(`A file with the name "${fullNewName}" already exists`);
                    return;
                  }
                  
                  try {
                    // Directly call the API to rename
                    await slideApi.update(id!, doc.id, { originalFileName: fullNewName });
                    
                    // Refresh the documents list
                    queryClient.invalidateQueries({ queryKey: ['slides', id] });
                    
                    // Update selected document if it's the one being renamed
                    if (documentManager.selectedDocument?.id === doc.id) {
                      documentManager.setSelectedDocument({ 
                        ...documentManager.selectedDocument, 
                        name: fullNewName 
                      });
                    }
                  } catch (error: any) {
                    alert(error.message || 'Failed to rename document');
                  }
                }}
                onFilesUploaded={async (files: File[]) => {
                  // Check for files that already exist
                  const existingFileNames = documentManager.documents.map(doc => ({ 
                    name: doc.name.toLowerCase(), 
                    doc 
                  }));
                  
                  const filesToProcess = files.map(file => {
                    const existing = existingFileNames.find(item => item.name === file.name.toLowerCase());
                    return { file, existingDoc: existing?.doc };
                  });
                  
                  const newFiles = filesToProcess.filter(item => !item.existingDoc).map(item => item.file);
                  
                  // Upload only new files (without showing duplicate error)
                  if (newFiles.length > 0) {
                    await documentManager.handleFilesUploaded(newFiles);
                    
                    // Wait for the query to be invalidated and refetched
                    await queryClient.invalidateQueries({ queryKey: ['slides', id] });
                    
                    // Wait a bit more for the UI to update
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                  
                  // Re-fetch documents after upload
                  const updatedSlides = await slideApi.getAll(id!);
                  
                  // Add all files to priority list
                  for (const { file, existingDoc } of filesToProcess) {
                    let doc = existingDoc;
                    
                    // If it was a new file, find it in the updated slides
                    if (!doc && updatedSlides) {
                      const matchingSlide = updatedSlides.find(slide => 
                        slide.originalFileName.toLowerCase() === file.name.toLowerCase()
                      );
                      if (matchingSlide) {
                        doc = {
                          id: matchingSlide.id,
                          name: matchingSlide.originalFileName,
                          type: matchingSlide.contentType,
                          size: matchingSlide.fileSize,
                          uploadedAt: new Date(matchingSlide.uploadTimestamp)
                        };
                      }
                    }
                    
                    if (doc) {
                      // Check if not already in indicator items
                      const currentItems = chatIndicatorItems;
                      if (!currentItems.some(item => item.id === doc.id)) {
                        const newItem = {
                          id: doc.id,
                          type: 'document' as const,
                          name: doc.name,
                          removable: true
                        };
                        setChatIndicatorItems([...currentItems, newItem]);
                      }
                    }
                  }
                }}
              />
            </DocumentPreview>
          </div>
        )}

        {/* Chat Only Section - when no document selected */}
        {!documentManager.selectedDocument && (
          <div className="flex-1 h-full pr-2">
            <MemoizedChatContainer
              key="chat-interface"
              messages={chatManager.messages}
              isAiLoading={chatManager.isAiLoading}
              onSubmit={handleCombinedSubmit}
              onClearChat={chatManager.handleClearChat}
              streamingMessageIds={chatManager.streamingMessageIds}
              onOpenInFile={handleOpenInFile}
              slides={allSlides}
              selectedTextForChat={selectedTextForChat}
              onClearSelectedText={clearSelectedText}
              courses={allCourses}
              isPdfPreviewOpen={false}
              onIndicatorItemsChange={setChatIndicatorItems}
              documents={documentManager.documents}
              onOpenDocument={(documentId: string) => {
                const doc = documentManager.documents.find(d => d.id === documentId);
                if (doc) {
                  documentManager.handlePreviewDocument(doc);
                }
              }}
              onRemoveDocument={(documentId: string) => {
                const doc = documentManager.documents.find(d => d.id === documentId);
                if (doc) {
                  documentManager.handleDeleteDocumentDirect(doc);
                }
              }}
              onRenameDocument={async (documentId: string, newName: string) => {
                const doc = documentManager.documents.find(d => d.id === documentId);
                if (!doc) return;
                
                // Get the file extension from the original name
                const fileExtension = doc.name.split('.').pop() || '';
                
                // Add the extension to the new name
                const fullNewName = fileExtension ? `${newName}.${fileExtension}` : newName;
                
                // Check for duplicate names first
                const existingDoc = documentManager.documents.find(
                  d => d.id !== doc.id && d.name.toLowerCase() === fullNewName.toLowerCase()
                );
                
                if (existingDoc) {
                  alert(`A file with the name "${fullNewName}" already exists`);
                  return;
                }
                
                try {
                  // Directly call the API to rename
                  await slideApi.update(id!, doc.id, { originalFileName: fullNewName });
                  
                  // Refresh the documents list
                  queryClient.invalidateQueries({ queryKey: ['slides', id] });
                  
                  // Update selected document if it's the one being renamed
                  if (documentManager.selectedDocument?.id === doc.id) {
                    documentManager.setSelectedDocument({ 
                      ...documentManager.selectedDocument, 
                      name: fullNewName 
                    });
                  }
                } catch (error: any) {
                  alert(error.message || 'Failed to rename document');
                }
              }}
              onFilesUploaded={async (files: File[]) => {
                // Check for files that already exist
                const existingFileNames = documentManager.documents.map(doc => ({ 
                  name: doc.name.toLowerCase(), 
                  doc 
                }));
                
                const filesToProcess = files.map(file => {
                  const existing = existingFileNames.find(item => item.name === file.name.toLowerCase());
                  return { file, existingDoc: existing?.doc };
                });
                
                const newFiles = filesToProcess.filter(item => !item.existingDoc).map(item => item.file);
                
                // Upload only new files (without showing duplicate error)
                if (newFiles.length > 0) {
                  await documentManager.handleFilesUploaded(newFiles);
                  
                  // Wait for the query to be invalidated and refetched
                  await queryClient.invalidateQueries({ queryKey: ['slides', id] });
                  
                  // Wait a bit more for the UI to update
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // Re-fetch documents after upload
                const updatedSlides = await slideApi.getAll(id!);
                
                // Add all files to priority list
                for (const { file, existingDoc } of filesToProcess) {
                  let doc = existingDoc;
                  
                  // If it was a new file, find it in the updated slides
                  if (!doc && updatedSlides) {
                    const matchingSlide = updatedSlides.find(slide => 
                      slide.originalFileName.toLowerCase() === file.name.toLowerCase()
                    );
                    if (matchingSlide) {
                      doc = {
                        id: matchingSlide.id,
                        name: matchingSlide.originalFileName,
                        type: matchingSlide.contentType,
                        size: matchingSlide.fileSize,
                        uploadedAt: new Date(matchingSlide.uploadTimestamp)
                      };
                    }
                  }
                  
                  if (doc) {
                    // Check if not already in indicator items
                    const currentItems = chatIndicatorItems;
                    if (!currentItems.some(item => item.id === doc.id)) {
                      const newItem = {
                        id: doc.id,
                        type: 'document' as const,
                        name: doc.name,
                        removable: true
                      };
                      setChatIndicatorItems([...currentItems, newItem]);
                    }
                  }
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Remove Document Modal */}
      <RemoveDocumentModal
        isOpen={documentManager.isDeleteModalOpen}
        onClose={documentManager.handleCloseDeleteModal}
        onRemoveDocument={documentManager.handleDeleteDocument}
        document={documentManager.documentToDelete}
      />

      {/* Edit Document Modal */}
      <EditDocumentModal
        isOpen={documentManager.isEditModalOpen}
        onClose={documentManager.handleCloseEditModal}
        onUpdateDocument={documentManager.handleUpdateDocument}
        document={documentManager.documentToEdit}
        initialName={documentManager.editInitialName}
      />

      {/* Delete Error Modal */}
      <DeleteErrorModal
        isOpen={documentManager.showDeleteError}
        onClose={documentManager.handleCloseDeleteError}
        errorMessage={documentManager.deleteErrorMessage}
      />

      {/* Upload Error Modal */}
      <DeleteErrorModal
        isOpen={documentManager.showUploadError}
        onClose={documentManager.handleCloseUploadError}
        errorMessage={documentManager.uploadErrorMessage}
      />
    </div>
  );
}; 
*/