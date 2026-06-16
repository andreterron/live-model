import { useMemo, useSyncExternalStore } from 'react';
import { HACKY_getCurrentLiveValue, Live } from '../live.js';
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
  const [subscribe, getSnapshot, setValue, deleteValue] = useMemo(
    () => [
      (onStoreChange: () => void) => {
        const sub = live.subscribe({
          next() {
            onStoreChange();
          },
        });
        return () => {
          sub.unsubscribe();
        };
      },
      () => HACKY_getCurrentLiveValue(live),
      (v: T) => {
        live.setValue(v);
      },
      () => {
        live.deleteValue();
      },
    ],
    [options?.equalityKey ? options.equalityKey(live) : live]
  );

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    value,
    setValue,
    deleteValue,
  };
}
