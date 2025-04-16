import { useLocalStorage } from 'usehooks-ts';
import { Live } from '../live.js';
import { HookReturn } from './hook-types.js';
import { useMemo } from 'react';

export interface UseLiveStateOptions {
  initializeWithValue?: boolean;
}

export function useLiveState(
  key: string,
  options?: UseLiveStateOptions
): HookReturn<any>;
export function useLiveState<T>(
  key: string,
  options?: UseLiveStateOptions
): HookReturn<T, T | undefined>;
export function useLiveState<T>(
  key: string,
  defaultValue: T,
  options?: UseLiveStateOptions
): HookReturn<T>;
export function useLiveState<T = unknown>(
  key: string,
  defaultValue?: T,
  options?: UseLiveStateOptions
): HookReturn<T, T | undefined> {
  const [value, setValue] = useLocalStorage(key, defaultValue, options);

  const live: Live<T> = useMemo(
    () => ({
      get: () => value,
      setValue(value) {
        setValue(value);
      },
    }),
    [value, setValue]
  );

  return {
    value,
    setValue,
    live,
  };
}
