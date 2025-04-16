import { Live } from '../live.js';

export interface HookReturn<T, OPT = T> {
  value: OPT;
  live: Live<T>;

  // Actions
  setValue: (value: OPT) => void;
}
