import { Live } from './live.js';

// TODO: This isn't generic enough
export type LiveDeleter<T> = (source: Live<T>) => void;

export const deleter = {
  passthrough<T>(): LiveDeleter<T> {
    return (source) => source.deleteValue();
  },
  handler<T = unknown>(handler: (source: Live<T>) => void): LiveDeleter<T> {
    return handler;
  },
  noop: undefined,
};
