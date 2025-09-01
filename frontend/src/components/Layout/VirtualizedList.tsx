import React, { useState, useEffect, useRef, useMemo } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  className?: string;
}

export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  overscan = 5,
  className = '',
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const { visibleItems, offsetY, totalHeight } = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItems = items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
    }));

    const offsetY = startIndex * itemHeight;
    const totalHeight = items.length * itemHeight;

    return { visibleItems, offsetY, totalHeight };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Auto-scroll to bottom when new items are added (for chat)
  useEffect(() => {
    if (scrollElementRef.current) {
      const element = scrollElementRef.current;
      const isNearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 100;
      
      if (isNearBottom) {
        element.scrollTop = element.scrollHeight;
      }
    }
  }, [items.length]);

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ item, index }) => (
            <div key={index} style={{ height: itemHeight }}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}