import { ChatMessage } from '../../types';

export const createUserMessage = (content: string): ChatMessage => {
  return {
    role: 'user',
    content,
    timestamp: new Date()
  };
};

export const createAiMessage = (content: string): ChatMessage => {
  return {
    role: 'assistant',
    content,
    timestamp: new Date(),
  };
};

export const simulateAiResponse = (userMessage: string): Promise<ChatMessage> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const aiResponse = createAiMessage(
        `I understand you're asking about "${userMessage}". Based on your uploaded documents, I can help you explore this topic further. This is a mock response for UI demonstration purposes.`
      );
      resolve(aiResponse);
    }, 1500);
  });
}; 