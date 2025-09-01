import { useRef, useEffect, useCallback } from 'react';
// import { TouchGesture } from '../types/pdf';

interface TouchGestureHandlers {
  onPinchZoom?: (scale: number, center: { x: number; y: number }) => void;
  onPan?: (deltaX: number, deltaY: number) => void;
  onTap?: (x: number, y: number) => void;
  onDoubleTap?: (x: number, y: number) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface TouchState {
  touches: Touch[];
  lastDistance: number;
  lastCenter: { x: number; y: number };
  initialPinchDistance: number;
  initialScale: number;
  lastTapTime: number;
  lastTapPosition: { x: number; y: number };
  isPinching: boolean;
  isPanning: boolean;
  panStart: { x: number; y: number };
}

export const useTouchGestures = (
  elementRef: React.RefObject<HTMLElement>,
  handlers: TouchGestureHandlers,
  options: {
    enablePinchZoom?: boolean;
    enablePan?: boolean;
    enableSwipe?: boolean;
    enableTap?: boolean;
    minPinchDistance?: number;
    maxScale?: number;
    minScale?: number;
    swipeThreshold?: number;
  } = {}
) => {
  const {
    enablePinchZoom = true,
    enablePan = true,
    enableSwipe = true,
    enableTap = true,
    minPinchDistance = 50,
    maxScale = 3.0,
    minScale = 0.3,
    swipeThreshold = 50
  } = options;

  const touchState = useRef<TouchState>({
    touches: [],
    lastDistance: 0,
    lastCenter: { x: 0, y: 0 },
    initialPinchDistance: 0,
    initialScale: 1,
    lastTapTime: 0,
    lastTapPosition: { x: 0, y: 0 },
    isPinching: false,
    isPanning: false,
    panStart: { x: 0, y: 0 }
  });

  const getDistance = useCallback((touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getCenter = useCallback((touch1: Touch, touch2: Touch): { x: number; y: number } => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }, []);

  const getTouchRelativeToElement = useCallback((touch: Touch, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }, []);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    event.preventDefault();
    
    const touches = Array.from(event.touches);
    touchState.current.touches = touches;

    if (touches.length === 1 && enableTap) {
      // Single touch - potential tap or pan start
      const touch = touches[0];
      const element = elementRef.current;
      if (!element) return;

      const position = getTouchRelativeToElement(touch, element);
      touchState.current.panStart = position;
      touchState.current.isPanning = false;

      // Check for double tap
      const now = Date.now();
      const timeSinceLastTap = now - touchState.current.lastTapTime;
      const distanceFromLastTap = Math.sqrt(
        Math.pow(position.x - touchState.current.lastTapPosition.x, 2) +
        Math.pow(position.y - touchState.current.lastTapPosition.y, 2)
      );

      if (timeSinceLastTap < 300 && distanceFromLastTap < 20) {
        // Double tap detected
        handlers.onDoubleTap?.(position.x, position.y);
        touchState.current.lastTapTime = 0; // Prevent triple tap
      } else {
        touchState.current.lastTapTime = now;
        touchState.current.lastTapPosition = position;
      }
    } else if (touches.length === 2 && enablePinchZoom) {
      // Two touches - pinch zoom
      const distance = getDistance(touches[0], touches[1]);
      const center = getCenter(touches[0], touches[1]);
      
      touchState.current.initialPinchDistance = distance;
      touchState.current.lastDistance = distance;
      touchState.current.lastCenter = center;
      touchState.current.isPinching = true;
      touchState.current.isPanning = false;
    }
  }, [elementRef, enableTap, enablePinchZoom, getTouchRelativeToElement, getDistance, getCenter, handlers]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    event.preventDefault();
    
    const touches = Array.from(event.touches);
    
    if (touches.length === 1 && enablePan && !touchState.current.isPinching) {
      // Single touch pan
      const touch = touches[0];
      const element = elementRef.current;
      if (!element) return;

      const position = getTouchRelativeToElement(touch, element);
      const deltaX = position.x - touchState.current.panStart.x;
      const deltaY = position.y - touchState.current.panStart.y;

      // Start panning if moved enough
      if (!touchState.current.isPanning && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        touchState.current.isPanning = true;
      }

      if (touchState.current.isPanning) {
        handlers.onPan?.(deltaX, deltaY);
      }
    } else if (touches.length === 2 && enablePinchZoom && touchState.current.isPinching) {
      // Pinch zoom
      const distance = getDistance(touches[0], touches[1]);
      const center = getCenter(touches[0], touches[1]);
      
      if (distance > minPinchDistance) {
        const scale = distance / touchState.current.initialPinchDistance;
        const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
        
        const element = elementRef.current;
        if (element) {
          const rect = element.getBoundingClientRect();
          const relativeCenter = {
            x: center.x - rect.left,
            y: center.y - rect.top
          };
          
          handlers.onPinchZoom?.(clampedScale, relativeCenter);
        }
        
        touchState.current.lastDistance = distance;
        touchState.current.lastCenter = center;
      }
    }
  }, [
    elementRef,
    enablePan,
    enablePinchZoom,
    getTouchRelativeToElement,
    getDistance,
    getCenter,
    minPinchDistance,
    minScale,
    maxScale,
    handlers
  ]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    const touches = Array.from(event.touches);
    
    if (touches.length === 0) {
      // All touches ended
      if (touchState.current.isPanning && enableSwipe) {
        // Check for swipe gesture
        const touch = touchState.current.touches[0];
        const element = elementRef.current;
        
        if (touch && element) {
          const endPosition = getTouchRelativeToElement(touch, element);
          const deltaX = endPosition.x - touchState.current.panStart.x;
          const deltaY = endPosition.y - touchState.current.panStart.y;
          
          // Check if it's a horizontal swipe
          if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0) {
              handlers.onSwipeRight?.();
            } else {
              handlers.onSwipeLeft?.();
            }
          }
        }
      } else if (
        !touchState.current.isPanning && 
        !touchState.current.isPinching && 
        enableTap &&
        touchState.current.touches.length === 1
      ) {
        // Single tap
        const touch = touchState.current.touches[0];
        const element = elementRef.current;
        
        if (touch && element) {
          const position = getTouchRelativeToElement(touch, element);
          
          // Only fire tap if we haven't moved much
          const deltaX = position.x - touchState.current.panStart.x;
          const deltaY = position.y - touchState.current.panStart.y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance < 10) {
            setTimeout(() => {
              // Delay to allow for potential double tap
              if (Date.now() - touchState.current.lastTapTime > 250) {
                handlers.onTap?.(position.x, position.y);
              }
            }, 250);
          }
        }
      }
      
      // Reset state
      touchState.current.isPinching = false;
      touchState.current.isPanning = false;
      touchState.current.touches = [];
    } else {
      // Some touches remaining
      touchState.current.touches = touches;
      
      if (touches.length === 1 && touchState.current.isPinching) {
        // Went from pinch to single touch
        touchState.current.isPinching = false;
      }
    }
  }, [
    elementRef,
    enableSwipe,
    enableTap,
    getTouchRelativeToElement,
    swipeThreshold,
    handlers
  ]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Add touch event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return touchState.current;
};