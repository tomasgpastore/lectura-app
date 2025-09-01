/**
 * Creates a debounced function that delays invoking the provided function
 * until after wait milliseconds have elapsed since the last time it was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function(this: any, ...args: Parameters<T>) {
    const later = () => {
      timeoutId = null;
      func.apply(this, args);
    };

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(later, wait);
  };
}

/**
 * Creates a throttled function that only invokes the provided function
 * at most once per every wait milliseconds.
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, wait);
    }
  };
}