import { CreateCourseDTO, PatchCourseDTO } from '../../types';
import { courseApi } from '../../lib/api/api';

export const createCourse = async (classData: CreateCourseDTO): Promise<void> => {
  await courseApi.create(classData);
};

export const updateCourse = async (
  courseId: string,
  updatedData: PatchCourseDTO
): Promise<void> => {
  // Only send the fields that are actually provided (not undefined/empty)
  const patchData: PatchCourseDTO = {};
  
  if (updatedData.name !== undefined && updatedData.name.trim() !== '') {
    patchData.name = updatedData.name.trim();
  }
  
  if (updatedData.code !== undefined && updatedData.code.trim() !== '') {
    patchData.code = updatedData.code.trim();
  }

  // Only make the API call if there's something to update
  if (Object.keys(patchData).length > 0) {
    await courseApi.update(courseId, patchData);
  }
};

export const deleteCourse = async (courseId: string): Promise<void> => {
  await courseApi.delete(courseId);
};