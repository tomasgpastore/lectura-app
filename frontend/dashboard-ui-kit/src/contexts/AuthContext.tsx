import React, { createContext, useContext, useState } from 'react';
import { authApi } from '../lib/api/api';
import { removeTokens } from '../utils/removeTokens';

interface AuthContextType {
  loginWithGoogle: (credentialResponse: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('csrfToken'));

  const loginWithGoogle = async (credentialResponse: any) => {
    setIsLoading(true);
    try {
      const idToken = credentialResponse.credential;

      // Send ID token to your backend
      const { csrfToken, user } = await authApi.loginWithGoogle(idToken);
      
      // Store CSRF token
      localStorage.setItem('csrfToken', csrfToken);
      
      // Store user info
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }

      setIsAuthenticated(true);
      console.log('Logged in with Google!');
    } catch (error) {
      console.error('Google login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      console.log('Refreshing access token...');
      
      const { csrfToken, user } = await authApi.refreshToken();
      
      // Update stored CSRF token
      localStorage.setItem('csrfToken', csrfToken);
      
      // Update user info
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }

      setIsAuthenticated(true);
      console.log('Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, logout the user
      await logout();
      return false;
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Call the backend logout endpoint (cookies will be sent automatically)
      await authApi.logout();
      
      console.log('Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      // Continue with local logout even if server logout fails
    } finally {
      // Always clear local state regardless of server response
      setIsAuthenticated(false);
      setIsLoading(false);
      removeTokens();
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ loginWithGoogle, logout, refreshToken, isLoading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};