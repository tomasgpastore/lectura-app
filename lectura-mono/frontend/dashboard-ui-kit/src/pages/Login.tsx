import React, { useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Brain } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const { loginWithGoogle, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleLoginSuccess = async (credentialResponse: any) => {
    await loginWithGoogle(credentialResponse);
    // Navigation will happen through the useEffect above when user state updates
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Brain className="w-16 h-16 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500" />
          </div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500 mb-2">
            LecturaLM
          </h1>
          <p className="text-gray-600 text-lg">
            Sign in to your account
          </p>
        </div>

        <div className="flex justify-center">
          {isLoading ? (
            <div className="px-8 py-4 bg-white/20 rounded-full backdrop-blur-sm">
              <span className="text-sm font-medium text-gray-700">
                Signing in...
              </span>
            </div>
          ) : (
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={() => console.log('Google login failed')}
              text="signin_with"
              shape="pill"
              size="large"
              useOneTap={false}
              auto_select={false}
              theme="outline"
            />
          )}
        </div>
      </div>
    </div>
  );
}; 