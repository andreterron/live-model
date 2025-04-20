import { Live } from './live.js';

// TODO: This isn't generic enough
export type LiveSetter<T, U> = (value: U, source: Live<T>) => void;

export const setter = {
  passthrough<T>(): LiveSetter<T, T> {
    return (v, source) => source.setValue(v);
  },
  transform<T, U>(transform: (value: U) => T): LiveSetter<T, U> {
    return (v, source) => source.setValue(transform(v));
  },
  handler<U, T = unknown>(
    handler: (value: U, source: Live<T>) => void
  ): LiveSetter<T, U> {
    return handler;
  },
  noop: undefined,
};
