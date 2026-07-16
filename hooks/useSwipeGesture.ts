import { useRef, useCallback } from "react";

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

const MIN_SWIPE_DISTANCE = 50; // px
const MAX_SWIPE_TIME = 500; // ms
const MAX_PERPENDICULAR_RATIO = 2; // horizontal vs vertical ratio

/**
 * Hook that attaches swipe gesture handlers to a DOM element.
 * Returns `bind` — spread these props onto the target element.
 */
export function useSwipeGesture(handlers: SwipeHandlers) {
  const start = useRef<TouchPoint | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!start.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.current.x;
      const dy = touch.clientY - start.current.y;
      const dt = Date.now() - start.current.time;
      start.current = null;

      if (dt > MAX_SWIPE_TIME) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx >= MIN_SWIPE_DISTANCE && absDx / Math.max(absDy, 1) >= MAX_PERPENDICULAR_RATIO / 2) {
        // Horizontal swipe
        if (dx > 0) {
          handlers.onSwipeRight?.();
        } else {
          handlers.onSwipeLeft?.();
        }
      } else if (absDy >= MIN_SWIPE_DISTANCE && absDy / Math.max(absDx, 1) >= MAX_PERPENDICULAR_RATIO / 2) {
        // Vertical swipe
        if (dy > 0) {
          handlers.onSwipeDown?.();
        } else {
          handlers.onSwipeUp?.();
        }
      }
    },
    [handlers]
  );

  return {
    onTouchStart,
    onTouchEnd,
  };
}
