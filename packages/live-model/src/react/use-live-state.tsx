import { LiveHookReturn, LiveHookWithDefaultReturn } from './hook-types.js';
import { useMemo } from 'react';
import { useLiveModelClient } from './use-live-model-client.js';
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
  // TODO: Use options.initializeWithValue?
  const client = useLiveModelClient();
  const live = useMemo(() => client.forKey<T>(key), [client, key]);

  const { value, setValue, deleteValue } = useSubscribe(live);

  return {
    value: value === undefined ? defaultValue : value,
    setValue,
    deleteValue,
    live,
  };
}
