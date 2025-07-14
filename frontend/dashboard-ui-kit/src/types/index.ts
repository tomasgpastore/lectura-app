export interface User {
  email: string;
  picture?: string;
}

export interface AuthResponseDTO {
  accessToken: string;
  refreshToken: string;
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
}

export interface ChatMessage {
  role: string;
  content: string;
  timestamp: number;
}

export interface ChatSource {
  source_id: number;
  slide_id: string;
  s3_file_name: string;
  page_start: number;
  page_end: number;
  raw_text: string;
  preview_text?: string;
}

export interface ChatMessageUI {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  role: string;
  sources?: ChatSource[];
  sourceMapping?: Record<number, ChatSource>;
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

export interface ChatFrontDTO {
  courseId: string;
  userPrompt: string;
  snapshot?: string;
}