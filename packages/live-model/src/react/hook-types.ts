import type { Operation } from '../protocol.js';
import { Live } from '../live.js';

export interface SubscribeHookReturn<T> {
  value: T | undefined;

  // Actions
  setValue: (value: T) => void;
  deleteValue: () => void;
}

export interface LiveHookReturn<T, OPS extends Operation = Operation> {
  live: Live<T, OPS>;

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
