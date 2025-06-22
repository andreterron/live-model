import { useCallback, useEffect, useRef, useState } from 'react';
import { Live } from '../live.js';
import { SubscribeHookReturn } from './hook-types.js';

export interface UseSubscribeOptions<T> {
  /**
   * Function to get an identifier for this live. Useful if the JS object
   * changes, even though it represents the same underlying data.
   */
  equalityKey?: (live: Live<T>) => string;
}

/**
 * @param live source of values
 * @param options customize the behavior of useSubscribe
 */
export function useSubscribe<T>(
  live: Live<T>,
  options?: UseSubscribeOptions<T>
): SubscribeHookReturn<T> {
  const [value, setV] = useState(live.get());
  const firstRef = useRef(true);

  useEffect(() => {
    const sub = live.subscribe({
      next(v) {
        // Skips first value since we used live.get() to get it.
        if (firstRef.current) {
          firstRef.current = false;
          return;
        }

        // Future values are set to state
        setV(v);
      },
    });
    return () => {
      sub.unsubscribe();
    };
  }, [options?.equalityKey ? options.equalityKey(live) : live]);

  const setValue = useCallback((v: T) => live.setValue(v), [live]);

  return {
    value,
    setValue,
  };
}
