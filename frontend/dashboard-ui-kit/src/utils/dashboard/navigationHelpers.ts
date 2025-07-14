import { NavigateFunction } from 'react-router-dom';

export const navigateToClass = (navigate: NavigateFunction, classId: string): void => {
  navigate(`/class/${classId}`);
};

export const navigateToHome = (navigate: NavigateFunction): void => {
  navigate('/');
};

export const navigateToLogin = (navigate: NavigateFunction): void => {
  navigate('/login');
}; 