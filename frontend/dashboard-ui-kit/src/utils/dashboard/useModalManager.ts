import { useState } from 'react';
import { Course } from '../../types';

export interface ModalState {
  isCreateModalOpen: boolean;
  isEditModalOpen: boolean;
  isRemoveModalOpen: boolean;
  selectedClass: Course | null;
}

export interface ModalActions {
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openEditModal: (classData: Course) => void;
  closeEditModal: () => void;
  openRemoveModal: (classData: Course) => void;
  closeRemoveModal: () => void;
}

export const useModalManager = (): ModalState & ModalActions => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Course | null>(null);

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const openEditModal = (classData: Course) => {
    setSelectedClass(classData);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedClass(null);
  };

  const openRemoveModal = (classData: Course) => {
    setSelectedClass(classData);
    setIsRemoveModalOpen(true);
  };

  const closeRemoveModal = () => {
    setIsRemoveModalOpen(false);
    setSelectedClass(null);
  };

  return {
    // State
    isCreateModalOpen,
    isEditModalOpen,
    isRemoveModalOpen,
    selectedClass,
    // Actions
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    openRemoveModal,
    closeRemoveModal,
  };
}; 