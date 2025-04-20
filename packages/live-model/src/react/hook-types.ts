import { Live } from '../live.js';

export interface HookReturn<T> {
  value: T;
  live: Live<T>;

  // Actions
  setValue: (value: T) => void;
}
