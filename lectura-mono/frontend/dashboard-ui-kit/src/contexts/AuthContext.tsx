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
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('accessToken'));

  const loginWithGoogle = async (credentialResponse: any) => {
    setIsLoading(true);
    try {
      const idToken = credentialResponse.credential;

      // Send ID token to your backend
      const { accessToken, refreshToken } = await authApi.loginWithGoogle(idToken);
      
      localStorage.setItem('accessToken', accessToken);
      
      // Store refresh token for logout endpoint
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
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
      const currentRefreshToken = localStorage.getItem('refreshToken');
      
      if (!currentRefreshToken) {
        console.log('No refresh token available');
        setIsAuthenticated(false);
        return false;
      }

      console.log('Refreshing access token...');
      
      const { accessToken, refreshToken: newRefreshToken } = await authApi.refreshToken(currentRefreshToken);
      
      // Update stored tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

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
      
      const currentRefreshToken = localStorage.getItem('refreshToken');
      const accessToken = localStorage.getItem('accessToken');
      
      if (currentRefreshToken && accessToken) {
        // Call the backend logout endpoint with refreshToken
        await authApi.logout(currentRefreshToken, accessToken);
      }
      
      console.log('Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      // Continue with local logout even if server logout fails
    } finally {
      // Always clear local state regardless of server response
      setIsAuthenticated(false);
      setIsLoading(false);
      removeTokens()
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ loginWithGoogle, logout, refreshToken, isLoading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}; 