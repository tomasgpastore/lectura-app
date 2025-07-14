import React from 'react';

interface PageLoaderProps {
  isLoading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ 
  isLoading, 
  children, 
  fallback 
}) => {
  if (isLoading) {
    return (
      <>
        {fallback || (
          <div className="min-h-screen bg-blue-50 dark:bg-neutral-900 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
            </div>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
};