export const calculateNewWidth = (
  clientX: number, 
  containerRect: DOMRect, 
  minWidth: number = 20, 
  maxWidth: number = 80
): number => {
  const newWidth = ((clientX - containerRect.left) / containerRect.width) * 100;
  
  // Constrain between min and max percentages
  if (newWidth >= minWidth && newWidth <= maxWidth) {
    return newWidth;
  }
  return newWidth < minWidth ? minWidth : maxWidth;
};

export const setupResizeListeners = (
  handleMouseMove: (e: MouseEvent) => void,
  handleMouseUp: () => void
) => {
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  
  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}; 