import { useEffect, useCallback } from 'react';

interface KeyboardShortcuts {
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onEscape?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcuts, enabled = true) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // Don't trigger shortcuts if user is typing in an input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    const { key, ctrlKey, metaKey, shiftKey } = event;
    const isModifierPressed = ctrlKey || metaKey;
    
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ': // Spacebar
        if (!shiftKey) {
          event.preventDefault();
          shortcuts.onNextPage?.();
        }
        break;
        
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        event.preventDefault();
        shortcuts.onPrevPage?.();
        break;
        
      case 'Escape':
        event.preventDefault();
        shortcuts.onEscape?.();
        break;
        
      case 'Home':
        if (isModifierPressed) {
          event.preventDefault();
          shortcuts.onHome?.();
        }
        break;
        
      case 'End':
        if (isModifierPressed) {
          event.preventDefault();
          shortcuts.onEnd?.();
        }
        break;
    }
  }, [shortcuts, enabled]);
  
  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);
};