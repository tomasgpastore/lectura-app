import React from 'react';
import { X } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: string;
}

interface PriorityDocumentsListProps {
  documents: Document[];
  onRemoveDocument: (documentId: string) => void;
}

export const PriorityDocumentsList: React.FC<PriorityDocumentsListProps> = ({ 
  documents, 
  onRemoveDocument 
}) => {
  if (documents.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {documents.map((doc) => (
        <div key={doc.id} className="transition-all duration-300 opacity-100 scale-1000 inline-block">
          <div className="relative">
            <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-md py-0.5 px-1 inline-block">
              <div className="flex items-center gap-1">
                <span className="text-xs text-orange-700 dark:text-orange-300 whitespace-nowrap">
                  {doc.name}
                </span>
                <button
                  onClick={() => onRemoveDocument(doc.id)}
                  className="ml-1 p-0.5 hover:bg-orange-200 dark:hover:bg-orange-800 rounded transition-colors"
                  aria-label={`Remove ${doc.name}`}
                >
                  <X className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};