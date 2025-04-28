import { Live } from '../live.js';

export interface SubscribeHookReturn<T> {
  value: T;

  // Actions
  setValue: (value: T) => void;
}

export interface HookReturn<T> extends SubscribeHookReturn<T> {
  live: Live<T>;
}
