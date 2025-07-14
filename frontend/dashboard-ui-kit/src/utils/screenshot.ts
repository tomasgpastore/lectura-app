/**
 * Captures a screenshot of the document preview container using HTML5 Canvas API
 * @param elementId - The ID of the element to capture
 * @returns Promise<string> - Base64 encoded image string
 */
export const captureDocumentSnapshot = async (elementId: string): Promise<string | null> => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn('Element not found for screenshot:', elementId);
      return null;
    }

    // Look for PDF canvas elements with multiple strategies
    let pdfCanvases = element.querySelectorAll('canvas');

    // If no direct canvases, look deeper in the DOM tree
    if (pdfCanvases.length === 0) {
      const deepCanvases = element.querySelectorAll('*');
      const foundCanvases: HTMLCanvasElement[] = [];
      
      deepCanvases.forEach(el => {
        if (el.tagName === 'CANVAS') {
          foundCanvases.push(el as HTMLCanvasElement);
        }
      });
      
      if (foundCanvases.length > 0) {
        pdfCanvases = foundCanvases as any;
      }
    }

    if (pdfCanvases.length === 0) {
      console.warn('No PDF canvas elements found');
      return null;
    }

    // Find the currently visible canvas (the one in the viewport)
    let targetCanvas: HTMLCanvasElement | null = null;
    let bestVisibilityScore = 0;

    pdfCanvases.forEach((canvas, index) => {
      const rect = canvas.getBoundingClientRect();
      const styles = window.getComputedStyle(canvas);
      
      // Calculate how much of the canvas is visible in the viewport
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Check if canvas is in viewport
      const isInViewport = rect.top < viewportHeight && 
                          rect.bottom > 0 && 
                          rect.left < viewportWidth && 
                          rect.right > 0;
      
      // Calculate visibility percentage
      let visibilityScore = 0;
      if (isInViewport) {
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(viewportHeight, rect.bottom);
        const visibleLeft = Math.max(0, rect.left);
        const visibleRight = Math.min(viewportWidth, rect.right);
        
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const visibleWidth = Math.max(0, visibleRight - visibleLeft);
        const visibleArea = visibleHeight * visibleWidth;
        const totalArea = rect.width * rect.height;
        
        visibilityScore = totalArea > 0 ? (visibleArea / totalArea) : 0;
      }
      
      // Log only in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Canvas ${index}:`, {
          width: rect.width,
          height: rect.height,
          visibilityScore: Math.round(visibilityScore * 100) + '%',
          isInViewport
        });
      }

      // Select the canvas with the highest visibility score that has actual content
      if (visibilityScore > bestVisibilityScore && 
          visibilityScore > 0.1 && // At least 10% visible
          styles.display !== 'none' && 
          styles.visibility !== 'hidden' && 
          canvas.width > 0 && 
          canvas.height > 0) {
        bestVisibilityScore = visibilityScore;
        targetCanvas = canvas;
      }
    });

    // If no canvas found with good visibility, fall back to the largest visible one
    if (!targetCanvas) {
      let maxArea = 0;
      
      pdfCanvases.forEach((canvas) => {
        const rect = canvas.getBoundingClientRect();
        const area = rect.width * rect.height;
        const styles = window.getComputedStyle(canvas);
        
        if (area > maxArea && rect.width > 0 && rect.height > 0 && 
            styles.display !== 'none' && styles.visibility !== 'hidden' && 
            canvas.width > 0 && canvas.height > 0) {
          maxArea = area;
          targetCanvas = canvas;
        }
      });
    }

    if (!targetCanvas) {
      console.warn('No visible PDF canvas found');
      return null;
    }

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    // Set output canvas size (reduce for bandwidth)
    const scale = 0.3; // Further reduce quality to save bandwidth
    outputCanvas.width = targetCanvas.width * scale;
    outputCanvas.height = targetCanvas.height * scale;

    // Draw the PDF canvas to our output canvas
    ctx.scale(scale, scale);
    ctx.drawImage(targetCanvas, 0, 0);

    const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.6);
    
    return dataUrl;
  } catch (error) {
    console.error('❌ Failed to capture screenshot:', error);
    return null;
  }
};

/**
 * Creates SVG representation of an element (simplified)
 */
const createSVGFromElement = (element: HTMLElement): string => {
  const rect = element.getBoundingClientRect();
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: 12px; padding: 20px;">
          Document preview screenshot not available with current implementation.
          This is a placeholder for the document content.
        </div>
      </foreignObject>
    </svg>
  `;
};

/**
 * Converts a data URL to base64 string (without the data URL prefix)
 * @param dataUrl - The data URL string
 * @returns string - Base64 encoded string
 */
export const dataUrlToBase64 = (dataUrl: string): string => {
  return dataUrl.split(',')[1];
};