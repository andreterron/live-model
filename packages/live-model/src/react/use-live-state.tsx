import { HookReturn } from './hook-types.js';
import { useMemo } from 'react';
import { LocalStorageLive } from '../creators/local-storage-live.js';
import { useSubscribe } from './use-subscribe.js';

export interface UseLiveStateOptions {
  initializeWithValue?: boolean;
}

export function useLiveState(
  key: string,
  defaultValue?: undefined,
  options?: UseLiveStateOptions
): HookReturn<unknown>;
export function useLiveState<T>(
  key: string,
  defaultValue?: undefined,
  options?: UseLiveStateOptions
): HookReturn<T | undefined>;
export function useLiveState<T>(
  key: string,
  defaultValue: T,
  options?: UseLiveStateOptions
): HookReturn<T>;
export function useLiveState<T = unknown>(
  key: string,
  defaultValue?: T,
  options?: UseLiveStateOptions
): HookReturn<T | undefined> {
  const live = useMemo(
    () =>
      new LocalStorageLive<T | undefined>(key, defaultValue, {
        initializeWithValue: options?.initializeWithValue,
      }),
    [key]
  );

  const { value, setValue } = useSubscribe(live);

  return {
    value,
    setValue,
    live,
  };
}
