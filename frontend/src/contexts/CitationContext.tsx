import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CitationContextType {
  expandedCitations: Set<string>;
  toggleCitation: (citationKey: string) => void;
  clearExpandedCitations: () => void;
}

const CitationContext = createContext<CitationContextType | undefined>(undefined);

export const useCitationContext = () => {
  const context = useContext(CitationContext);
  if (!context) {
    throw new Error('useCitationContext must be used within a CitationProvider');
  }
  return context;
};

interface CitationProviderProps {
  children: ReactNode;
}

export const CitationProvider: React.FC<CitationProviderProps> = ({ children }) => {
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());

  const toggleCitation = (citationKey: string) => {
    setExpandedCitations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(citationKey)) {
        newSet.delete(citationKey);
      } else {
        newSet.add(citationKey);
      }
      return newSet;
    });
  };

  const clearExpandedCitations = () => {
    setExpandedCitations(new Set());
  };

  return (
    <CitationContext.Provider
      value={{
        expandedCitations,
        toggleCitation,
        clearExpandedCitations,
      }}
    >
      {children}
    </CitationContext.Provider>
  );
};