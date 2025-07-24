import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Course } from '../../../types';
import { createCommands, CommandWithParameter } from './commandDefinitions';

interface Document {
  id: string;
  name: string;
}

interface UseCommandsProps {
  onClearChat?: () => void;
  courses?: Course[];
  documents?: Document[];
  onOpenDocument?: (documentId: string) => void;
  onRemoveDocument?: (documentId: string) => void;
  onRenameDocument?: (documentId: string, newName: string) => void;
  setInternalValue: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  resetHeight: () => void;
  addToHistory?: (command: string) => void;
}

export const useCommands = ({
  onClearChat,
  courses = [],
  documents = [],
  onOpenDocument,
  onRemoveDocument,
  onRenameDocument,
  setInternalValue,
  textareaRef,
  resetHeight,
  addToHistory,
}: UseCommandsProps) => {
  const { isDark, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [showCommands, setShowCommands] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [commandFilter, setCommandFilter] = useState('');
  const [showClassSuggestions, setShowClassSuggestions] = useState(false);
  const [selectedClassIndex, setSelectedClassIndex] = useState(0);
  const [classFilter, setClassFilter] = useState('');
  const [showDocumentSuggestions, setShowDocumentSuggestions] = useState(false);
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState(0);
  const [documentFilter, setDocumentFilter] = useState('');

  // Command handlers
  const handleClearChat = useCallback(() => {
    if (onClearChat) {
      onClearChat();
      setInternalValue('');
      setShowCommands(false);
      if (textareaRef.current) {
        textareaRef.current.value = '';
        resetHeight();
      }
    }
  }, [onClearChat, setInternalValue, resetHeight, textareaRef]);

  const handleThemeChange = useCallback((theme: 'light' | 'dark') => {
    if ((theme === 'light' && isDark) || (theme === 'dark' && !isDark)) {
      toggleTheme();
    }
  }, [isDark, toggleTheme]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const handleNavigateToClass = useCallback((classId: string) => {
    navigate(`/class/${classId}`);
  }, [navigate]);

  // Create commands with handlers
  const allCommands = useMemo(
    () => createCommands({
      onClearChat: handleClearChat,
      onThemeChange: handleThemeChange,
      onLogout: handleLogout,
      onNavigateToClass: handleNavigateToClass,
      onOpenDocument: onOpenDocument,
      onRemoveDocument: onRemoveDocument,
      onRenameDocument: onRenameDocument,
    }),
    [handleClearChat, handleThemeChange, handleLogout, handleNavigateToClass, onOpenDocument, onRemoveDocument, onRenameDocument]
  );

  // Filter commands based on input
  const filteredCommands = useMemo(
    () => allCommands.filter(cmd => 
      cmd.name.toLowerCase().startsWith(commandFilter.toLowerCase())
    ),
    [allCommands, commandFilter]
  );

  // Filter courses based on input
  const filteredCourses = useMemo(
    () => courses.filter(course => 
      course.name.toLowerCase().includes(classFilter.toLowerCase()) ||
      course.code.toLowerCase().includes(classFilter.toLowerCase())
    ),
    [courses, classFilter]
  );

  // Filter documents based on input
  const filteredDocuments = useMemo(
    () => documents.filter(doc => 
      doc.name.toLowerCase().includes(documentFilter.toLowerCase())
    ),
    [documents, documentFilter]
  );

  // Handle command selection
  const selectCommand = useCallback((command: CommandWithParameter) => {
    if (command.name === '/theme') {
      setInternalValue('/theme ');
      setShowCommands(false);
      setCommandFilter('');
      setSelectedCommandIndex(0);
      if (textareaRef.current) {
        textareaRef.current.value = '/theme ';
        textareaRef.current.focus();
      }
    } else if (command.name === '/cd') {
      setInternalValue('/cd ');
      setShowCommands(false);
      setCommandFilter('');
      setSelectedCommandIndex(0);
      setShowClassSuggestions(true);
      setClassFilter('');
      if (textareaRef.current) {
        textareaRef.current.value = '/cd ';
        textareaRef.current.focus();
      }
    } else if (command.name === '/open') {
      setInternalValue('/open ');
      setShowCommands(false);
      setCommandFilter('');
      setSelectedCommandIndex(0);
      setShowDocumentSuggestions(true);
      setDocumentFilter('');
      setSelectedDocumentIndex(0);
      if (textareaRef.current) {
        textareaRef.current.value = '/open ';
        textareaRef.current.focus();
      }
    } else if (command.name === '/remove') {
      setInternalValue('/remove ');
      setShowCommands(false);
      setCommandFilter('');
      setSelectedCommandIndex(0);
      setShowDocumentSuggestions(true);
      setDocumentFilter('');
      setSelectedDocumentIndex(0);
      if (textareaRef.current) {
        textareaRef.current.value = '/remove ';
        textareaRef.current.focus();
      }
    } else if (command.name === '/rename') {
      setInternalValue('/rename ');
      setShowCommands(false);
      setCommandFilter('');
      setSelectedCommandIndex(0);
      setShowDocumentSuggestions(true);
      setDocumentFilter('');
      setSelectedDocumentIndex(0);
      if (textareaRef.current) {
        textareaRef.current.value = '/rename ';
        textareaRef.current.focus();
      }
    } else {
      command.action();
      setShowCommands(false);
      setCommandFilter('');
      setSelectedCommandIndex(0);
    }
  }, [setInternalValue, textareaRef]);

  // Handle class selection
  const selectClass = useCallback((course: Course) => {
    // Save the command to history before navigating
    const commandText = `/cd ${course.name}`;
    if (addToHistory) {
      addToHistory(commandText);
    }
    
    navigate(`/class/${course.id}`);
    setInternalValue('');
    setShowClassSuggestions(false);
    setClassFilter('');
    setSelectedClassIndex(0);
    if (textareaRef.current) {
      textareaRef.current.value = '';
      resetHeight();
    }
  }, [navigate, setInternalValue, resetHeight, textareaRef, addToHistory]);

  // Handle document selection
  const selectDocument = useCallback((document: Document) => {
    const currentValue = textareaRef.current?.value || '';
    
    if (currentValue.startsWith('/open ')) {
      const commandText = `/open ${document.name}`;
      if (addToHistory) {
        addToHistory(commandText);
      }
      if (onOpenDocument) {
        onOpenDocument(document.id);
      }
      setInternalValue('');
      setShowDocumentSuggestions(false);
      setDocumentFilter('');
      setSelectedDocumentIndex(0);
      if (textareaRef.current) {
        textareaRef.current.value = '';
        resetHeight();
      }
    } else if (currentValue.startsWith('/remove ')) {
      const commandText = `/remove ${document.name}`;
      if (addToHistory) {
        addToHistory(commandText);
      }
      if (onRemoveDocument) {
        onRemoveDocument(document.id);
      }
      setInternalValue('');
      setShowDocumentSuggestions(false);
      setDocumentFilter('');
      setSelectedDocumentIndex(0);
      if (textareaRef.current) {
        textareaRef.current.value = '';
        resetHeight();
      }
    } else if (currentValue.startsWith('/rename ')) {
      // For rename, append the document name and wait for new name
      const newValue = `/rename ${document.name} `;
      setInternalValue(newValue);
      setShowDocumentSuggestions(false);
      setDocumentFilter('');
      setSelectedDocumentIndex(0);
      if (textareaRef.current) {
        textareaRef.current.value = newValue;
        textareaRef.current.focus();
      }
    }
  }, [onOpenDocument, onRemoveDocument, setInternalValue, resetHeight, textareaRef, addToHistory]);

  // Execute command with parameter
  const executeCommandWithParameter = useCallback((commandName: string, parameter: string) => {
    const command = allCommands.find(cmd => cmd.name === commandName);
    if (command?.handleParameter) {
      command.handleParameter(parameter);
    }

    // Special handling for /cd command
    if (commandName === '/cd') {
      const matchedCourse = courses.find(course => 
        course.name.toLowerCase() === parameter.toLowerCase() ||
        course.code.toLowerCase() === parameter.toLowerCase()
      );
      if (matchedCourse) {
        navigate(`/class/${matchedCourse.id}`);
      }
    }

    // Special handling for /open command
    if (commandName === '/open') {
      const matchedDocument = documents.find(doc => 
        doc.name.toLowerCase() === parameter.toLowerCase()
      );
      if (matchedDocument && onOpenDocument) {
        onOpenDocument(matchedDocument.id);
      }
    }

    // Special handling for /remove command
    if (commandName === '/remove') {
      const matchedDocument = documents.find(doc => 
        doc.name.toLowerCase() === parameter.toLowerCase()
      );
      if (matchedDocument && onRemoveDocument) {
        onRemoveDocument(matchedDocument.id);
      }
    }

    // Special handling for /rename command
    if (commandName === '/rename') {
      const parts = parameter.split(' ');
      if (parts.length >= 2) {
        const documentName = parts[0];
        const newName = parts.slice(1).join(' ');
        const matchedDocument = documents.find(doc => 
          doc.name.toLowerCase() === documentName.toLowerCase()
        );
        if (matchedDocument && onRenameDocument) {
          onRenameDocument(matchedDocument.id, newName);
        }
      }
    }

    // Clear input
    setInternalValue('');
    if (textareaRef.current) {
      textareaRef.current.value = '';
      resetHeight();
    }
  }, [allCommands, courses, documents, navigate, onOpenDocument, onRemoveDocument, onRenameDocument, setInternalValue, textareaRef, resetHeight]);

  return {
    // State
    showCommands,
    setShowCommands,
    selectedCommandIndex,
    setSelectedCommandIndex,
    commandFilter,
    setCommandFilter,
    showClassSuggestions,
    setShowClassSuggestions,
    selectedClassIndex,
    setSelectedClassIndex,
    classFilter,
    setClassFilter,
    showDocumentSuggestions,
    setShowDocumentSuggestions,
    selectedDocumentIndex,
    setSelectedDocumentIndex,
    documentFilter,
    setDocumentFilter,
    
    // Data
    allCommands,
    filteredCommands,
    filteredCourses,
    filteredDocuments,
    
    // Actions
    selectCommand,
    selectClass,
    selectDocument,
    executeCommandWithParameter,
  };
};