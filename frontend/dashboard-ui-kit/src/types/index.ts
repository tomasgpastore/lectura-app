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

export interface ChatFrontDTO {
  courseId: string;
  userPrompt: string;
  snapshot?: string;
}

export interface Source {
  id: string;
  slide: string;
  s3file: string;
  start: string;
  end: string;
  text: string;
}

export interface ChatResponseDTO {
  data: Source[];
  response: string;
}