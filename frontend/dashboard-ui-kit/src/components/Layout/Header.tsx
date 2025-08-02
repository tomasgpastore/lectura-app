import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, LogOut, ChevronDown, User } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { User as UserType } from '../../types';
import { authApi } from '../../lib/api/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface HeaderProps {
  showAuth?: boolean;
  courseName?: string;
  courseCode?: string;
  lightBlueTheme?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ showAuth = true, courseName, courseCode, lightBlueTheme = false }) => {
  const { isDark, toggleTheme } = useTheme();
  const { logout, isLoading } = useAuth();
  const [user, setUser] = useState<UserType | null>(() => {
    // Initialize user from localStorage if available
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();


  const { data: userData } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const csrfToken = localStorage.getItem('csrfToken');
      if (csrfToken) {
        return authApi.getCurrentUser();
      }
      return Promise.reject(new Error('Not authenticated'));
    },
    enabled: !!localStorage.getItem('csrfToken')
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (userData) {
      setUser(userData);
    }
  }, [userData]);

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await logout();
    setUser(null); // Clear local user state
    queryClient.invalidateQueries({ queryKey: ['user'] }); // Clear user query cache
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 ${lightBlueTheme ? 'bg-blue-50/80' : 'bg-white/80'} dark:bg-neutral-900/80 backdrop-blur-xl`}>
      <div className="mx-auto px-1 sm:px-2 lg:px-3">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-4">
              <a href="/">
                <img 
                  src="/logo.svg" 
                  alt="Lectura Logo" 
                  className="h-8"
                />
              </a>
              {courseName && (
                <>
                  <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                  <div>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {courseName}
                    </span>
                    {courseCode && (
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        {courseCode}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {showAuth && user && (
              <div className="relative" ref={dropdownRef}>
                {/* User Profile Button */}
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2 p-2 rounded-xl bg-white/20 dark:bg-neutral-800/20 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all duration-200 backdrop-blur-sm"
                >
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.email}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <ChevronDown 
                    className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${
                      isDropdownOpen ? 'rotate-180' : ''
                    }`} 
                  />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-700 backdrop-blur-xl z-50 py-2">
                    {/* Email */}
                    <div className="px-2 py-1">
                      <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user.email}
                        </p>
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="mx-3 border-b border-gray-200 dark:border-neutral-700"></div>

                    {/* Theme Toggle */}
                    <div className="px-2 py-1">
                      <button
                        onClick={toggleTheme}
                        className="flex items-center justify-between w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <span className="text-sm text-gray-700 dark:text-neutral-300">
                          Theme
                        </span>
                        <div className="flex items-center space-x-2">
                          {isDark ? (
                            <>
                              <Moon className="w-4 h-4 text-gray-400" />
                              <span className="text-xs text-gray-500">Dark</span>
                            </>
                          ) : (
                            <>
                              <Sun className="w-4 h-4 text-yellow-500" />
                              <span className="text-xs text-gray-500">Light</span>
                            </>
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="mx-3 border-b border-gray-200 dark:border-neutral-700"></div>

                    {/* Logout */}
                    <div className="px-2 pt-1 pb-0">
                      <button
                        onClick={handleLogout}
                        disabled={isLoading}
                        className="flex items-center space-x-3 w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-gray-600 dark:border-gray-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <LogOut className="w-4 h-4 text-red-500" />
                        )}
                        <span className="text-sm text-gray-700 dark:text-neutral-300">
                          {isLoading ? 'Logging out...' : 'Log out'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}; 