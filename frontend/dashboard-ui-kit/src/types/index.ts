export interface User {
  email: string;
  picture?: string;
}

export interface AuthResponseDTO {
  csrfToken: string;
  user: UserResponseDTO;
}

export interface UserResponseDTO {
  email: string;
  picture?: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  content?: string;
  isLoading?: boolean;
  uploadProgress?: number; // Progress percentage (0-100)
}

export interface ChatMessage {
  role: string;
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
}


export interface ChatSource {
  id: string;
  slide: string;
  s3file: string;
  start: string;
  end: string;
  text: string;
  preview_text?: string;
  type?: 'rag' | 'web' | 'page'; // Add type to distinguish source types
  title?: string; // For web sources
  url?: string; // For web sources
  pageNumber?: number; // For page sources
}

export interface ChatMessageUI {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  role: string;
  sources?: ChatSource[];
  sourceMapping?: Record<string, ChatSource>;
} 

export interface Course {
  id: string;
  slideId: string[];
  code: string;
  name: string;
  summary?: string;
}

export interface CreateCourseDTO {
  code: string;
  name: string;
}

export interface PatchCourseDTO {
  code?: string;
  name?: string;
}

export interface Slide {
  id: string;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  storageFileName: string;
  courseId: string;
  pageCount: number;
  uploadTimestamp: string;
}

export interface PatchSlideDTO {
  originalFileName?: string;
}

export enum SearchType {
  DEFAULT,
  RAG,
  WEB,
  RAG_WEB,
}

export interface Snapshot {
  slide_id: string;
  page_number: number;
}

export interface ChatFrontDTO {
  courseId: string;
  userPrompt: string;
  snapshot?: Snapshot;
  priorityDocuments: string[];
  searchType: SearchType;
}

export interface RagSource {
  id: string;
  slide: string;
  s3file: string;
  start: string;
  end: string;
  text: string;
}

export interface WebSource {
  id: string;
  title: string;
  url: string;
  text: string;
}

export interface ImageSource {
  id: string;
  type: string;
  messageId: string | null;
  timestamp: string;
  slideId: string;
  pageNumber: number;
}

export interface ChatResponseDTO {
  response: string;
  ragSources: RagSource[];
  webSources: WebSource[];
  imageSources?: ImageSource[];
}
