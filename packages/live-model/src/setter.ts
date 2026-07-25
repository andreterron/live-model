import { Live } from './live.js';

export const setter = {
  passthrough<T>() {
    return (source: Live<T>, value: T) => source.setValue(value);
  },
  transform<T, U>(transform: (value: U) => T) {
    return (source: Live<T>, value: U) => source.setValue(transform(value));
  },
  handler<U, T = unknown>(handler: (source: Live<T>, value: U) => void) {
    return handler;
  },
};
