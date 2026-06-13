import { Live } from '../live.js';

export interface SubscribeHookReturn<T> {
  value: T | undefined;

  // Actions
  setValue: (value: T) => void;
  deleteValue: () => void;
}

export interface LiveHookReturn<T> {
  live: Live<T>;

  value: T | undefined;

  // Actions
  setValue: (value: T) => void;
  deleteValue: () => void;
}

export interface LiveHookWithDefaultReturn<T> {
  live: Live<T>;

  value: T;

  // Actions
  setValue: (value: T) => void;
  deleteValue: () => void;
}
