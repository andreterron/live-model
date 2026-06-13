import { LiveHookReturn, LiveHookWithDefaultReturn } from './hook-types.js';
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
): LiveHookReturn<unknown>;
export function useLiveState<T>(
  key: string,
  defaultValue?: undefined,
  options?: UseLiveStateOptions
): LiveHookReturn<T>;
export function useLiveState<T>(
  key: string,
  defaultValue: T,
  options?: UseLiveStateOptions
): LiveHookWithDefaultReturn<T>;
export function useLiveState<T = unknown>(
  key: string,
  defaultValue?: T,
  options?: UseLiveStateOptions
): LiveHookReturn<T> {
  const live = useMemo(
    () =>
      new LocalStorageLive<T>(key, {
        initializeWithValue: options?.initializeWithValue,
      }),
    [key]
  );

  const { value, setValue, deleteValue } = useSubscribe(live);

  return {
    value: value ?? defaultValue,
    setValue,
    deleteValue,
    live,
  };
}
