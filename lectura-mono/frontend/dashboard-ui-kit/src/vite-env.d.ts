/// <reference types="vite/client" />

declare module 'react-pdf' {
  export interface DocumentProps {
    file: string | File | null;
    onLoadSuccess?: (pdf: { numPages: number }) => void;
    onLoadError?: (error: any) => void;
    loading?: React.ReactNode;
    error?: React.ReactNode;
    children?: React.ReactNode;
  }

  export interface PageProps {
    pageNumber: number;
    scale?: number;
    renderTextLayer?: boolean;
    renderAnnotationLayer?: boolean;
    className?: string;
  }

  export const Document: React.FC<DocumentProps>;
  export const Page: React.FC<PageProps>;
  export const pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: string;
    };
  };
} 