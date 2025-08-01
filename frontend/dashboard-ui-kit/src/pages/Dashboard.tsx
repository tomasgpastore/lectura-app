import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Layout/Header';
import { PageLoader } from '../components/Layout/PageLoader';
import { ClassCard } from '../components/Dashboard/ClassCard';
import { CreateClassModal } from '../components/Dashboard/CreateClassModal';
import { EditClassModal } from '../components/Dashboard/EditClassModal';
import { RemoveClassModal } from '../components/Dashboard/RemoveClassModal';
import { Course, CreateCourseDTO, PatchCourseDTO } from '../types';
import { courseApi } from '../lib/api/api';
import { useAuth } from '../contexts/AuthContext';
import { useModalManager } from '../utils/dashboard/useModalManager';
import { createCourse, updateCourse, deleteCourse } from '../utils/dashboard/classOperations';
import { navigateToClass } from '../utils/dashboard/navigationHelpers';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  // Modal management
  const {
    isCreateModalOpen,
    isEditModalOpen,
    isRemoveModalOpen,
    selectedClass,
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    openRemoveModal,
    closeRemoveModal,
  } = useModalManager();

  // Loading state for course creation
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseApi.getAll(),
    staleTime: 5 * 60 * 1000, // Consider courses fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch when returning to dashboard
    refetchOnMount: false, // Don't refetch on mount if data exists
  });

  // Event handlers with React Query optimistic updates
  const handleCreateClass = async (classData: CreateCourseDTO) => {
    try {
      setIsCreatingCourse(true);
      
      // Optimistic update: immediately add to courses list for visual feedback
      const optimisticCourse: Course = {
        id: `optimistic-${Date.now()}`, // Temporary ID just for UI
        name: classData.name,
        code: classData.code,
        slideId: [],
        summary: undefined
      };

      queryClient.setQueryData(['courses'], (old: Course[] = []) => [
        ...old,
        optimisticCourse
      ]);

      // Close modal immediately
      closeCreateModal();

      // Make API call and get real course data
      await createCourse(classData);
      
      // Refresh to get the real course data with real ID
      await queryClient.invalidateQueries({ queryKey: ['courses'] });
      
      // Get the updated courses and find the newest one
      const updatedCourses = queryClient.getQueryData(['courses']) as Course[];
      if (updatedCourses) {
        // Find the real course (should be the most recent non-optimistic one)
        const realCourse = updatedCourses
          .filter(c => !c.id.startsWith('optimistic-'))
          .sort((a, b) => b.id.localeCompare(a.id))[0]; // Assuming newer IDs are "larger"
        
        if (realCourse) {
          setIsCreatingCourse(false);
          navigateToClass(navigate, realCourse.id);
        }
      }
      
    } catch (error) {
      console.error('Failed to create course:', error);
      setIsCreatingCourse(false);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    }
  };

  const handleEditClass = async (updatedData: PatchCourseDTO) => {
    if (selectedClass) {
      try {
        // Optimistic update: immediately update courses list cache
        queryClient.setQueryData(['courses'], (old: Course[] = []) =>
          old.map(course =>
            course.id === selectedClass.id
              ? { ...course, ...updatedData }
              : course
          )
        );

        // Also update individual course cache for immediate Class page updates
        queryClient.setQueryData(['course', selectedClass.id], (old: Course | undefined) =>
          old ? { ...old, ...updatedData } : undefined
        );

        // Make API call
        await updateCourse(selectedClass.id, updatedData);
        
        // Background refetch to ensure consistency
        queryClient.invalidateQueries({ queryKey: ['courses'] });
        queryClient.invalidateQueries({ queryKey: ['course', selectedClass.id] });
        
        closeEditModal();
      } catch (error) {
        console.error('Failed to update course:', error);
        // Revert optimistic update on error
        queryClient.invalidateQueries({ queryKey: ['courses'] });
        queryClient.invalidateQueries({ queryKey: ['course', selectedClass.id] });
      }
    }
  };

  const handleRemoveClass = async () => {
    if (selectedClass) {
      try {
        // Optimistic update: immediately remove from cache
        queryClient.setQueryData(['courses'], (old: Course[] = []) =>
          old.filter(course => course.id !== selectedClass.id)
        );

        // Make API call
        await deleteCourse(selectedClass.id);
        
        // Background refetch to ensure consistency
        queryClient.invalidateQueries({ queryKey: ['courses'] });
        
        closeRemoveModal();
      } catch (error) {
        console.error('Failed to delete course:', error);
        // Revert optimistic update on error
        queryClient.invalidateQueries({ queryKey: ['courses'] });
      }
    }
  };

  const handleClassClick = (classId: string) => {
    navigateToClass(navigate, classId);
  };

  return (
    <PageLoader isLoading={coursesLoading}>
      <div className="min-h-screen bg-white dark:bg-neutral-900 transition-colors duration-200">
        <Header />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Your Classes
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your classes files and AI-powered learning sessions
            </p>
          </div>
          
          {courses.length > 0 && (
            <button
              onClick={openCreateModal}
              className="group flex items-center px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
              New Class
            </button>
          )}
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-24 mt-16">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Plus className="w-12 h-12 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No classes yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first class to start organizing your study materials
            </p>
            <button
              onClick={openCreateModal}
              className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
              Create Class
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((classItem: Course) => (
              <ClassCard
                key={classItem.id}
                classData={classItem}
                onClick={() => handleClassClick(classItem.id)}
                onEdit={openEditModal}
                onRemove={openRemoveModal}
              />
            ))}
          </div>
        )}
      </div>

      <CreateClassModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        onCreateClass={handleCreateClass} 
      />

      <EditClassModal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        onEditClass={handleEditClass}
        classData={selectedClass}
      />

      <RemoveClassModal
        isOpen={isRemoveModalOpen}
        onClose={closeRemoveModal}
        onRemoveClass={handleRemoveClass}
        classData={selectedClass}
      />

      {/* Course Creation Loading Overlay */}
      {isCreatingCourse && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-8 shadow-2xl max-w-sm mx-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-orange-200 dark:border-orange-900 rounded-full animate-spin"></div>
                <div className="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-t-orange-600 rounded-full animate-spin"></div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Creating your class...
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Setting up your course materials and preparing the workspace
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </PageLoader>
  );
}; 