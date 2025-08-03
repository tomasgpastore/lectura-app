/**
 * Captures a screenshot of the document preview container using HTML5 Canvas API
 * @param elementId - The ID of the element to capture
 * @param highQuality - Whether to use high quality mode (default: true)
 * @returns Promise<Uint8Array | null> - Byte array of the image
 */
export const captureDocumentSnapshot = async (elementId: string, highQuality: boolean = true): Promise<Uint8Array | null> => {
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

    // Configure quality based on settings
    const scale = highQuality ? 1.5 : 1.0; // Use even higher resolution for high quality mode
    const maxWidth = 2048; // Reasonable maximum to avoid memory issues
    const maxHeight = 2048;
    
    // Calculate actual dimensions
    let finalWidth = targetCanvas["width"] * scale;  
    let finalHeight = targetCanvas["height"] * scale;

    // Constrain to maximum dimensions while maintaining aspect ratio
    if (finalWidth > maxWidth || finalHeight > maxHeight) {
      const aspectRatio = finalWidth / finalHeight;
      if (finalWidth > finalHeight) {
        finalWidth = maxWidth;
        finalHeight = maxWidth / aspectRatio;
      } else {
        finalHeight = maxHeight;
        finalWidth = maxHeight * aspectRatio;
      }
    }
    
    outputCanvas.width = finalWidth;
    outputCanvas.height = finalHeight;

    // Configure canvas for optimal text rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Additional context properties for better rendering
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, finalWidth, finalHeight); // White background for better contrast
    
    // Apply appropriate scaling  
    const scaleX = finalWidth / (targetCanvas as HTMLCanvasElement).width;
    const scaleY = finalHeight / (targetCanvas as HTMLCanvasElement).height;
    ctx.scale(scaleX, scaleY);
    
    // Draw the PDF canvas to our output canvas
    ctx.drawImage(targetCanvas, 0, 0);

    // Convert canvas to blob and then to byte array
    return new Promise((resolve, reject) => {
      // First try PNG format
      outputCanvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from canvas'));
          return;
        }

        // Check if PNG is too large (>2MB)
        if (blob.size > 2 * 1024 * 1024) {
          // Fall back to high quality JPEG
          outputCanvas.toBlob(async (jpegBlob) => {
            if (!jpegBlob) {
              reject(new Error('Failed to create JPEG blob from canvas'));
              return;
            }

            // Convert blob to byte array
            const arrayBuffer = await jpegBlob.arrayBuffer();
            const byteArray = new Uint8Array(arrayBuffer);
            
            // Log quality info in development
            if (process.env.NODE_ENV === 'development') {
              const sizeKB = Math.round(jpegBlob.size / 1024);
              console.log(`📸 Captured snapshot (JPEG): ${finalWidth}x${finalHeight}, ${sizeKB}KB`);
            }
            
            resolve(byteArray);
          }, 'image/jpeg', 0.95);
        } else {
          // Use PNG if size is acceptable
          const arrayBuffer = await blob.arrayBuffer();
          const byteArray = new Uint8Array(arrayBuffer);
          
          // Log quality info in development
          if (process.env.NODE_ENV === 'development') {
            const sizeKB = Math.round(blob.size / 1024);
            console.log(`📸 Captured snapshot (PNG): ${finalWidth}x${finalHeight}, ${sizeKB}KB`);
          }
          
          resolve(byteArray);
        }
      }, 'image/png');
    });
  } catch (error) {
    console.error('❌ Failed to capture screenshot:', error);
    return null;
  }
};

/**
 * Converts a byte array to base64 string
 * @param bytes - The byte array
 * @returns string - Base64 encoded string
 */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};