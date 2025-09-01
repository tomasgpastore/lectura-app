import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MainRouter from './routers/MainRouter.tsx';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider 
      clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
      onScriptLoadError={() => console.log('Google script failed to load')}
      onScriptLoadSuccess={() => console.log('Google script loaded successfully')}
    >
      <MainRouter />
    </GoogleOAuthProvider>
    </QueryClientProvider>
  </StrictMode>
); 