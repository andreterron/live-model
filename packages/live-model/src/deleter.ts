import { Live } from './live.js';

export const deleter = {
  passthrough<T>() {
    return (source: Live<T>) => source.deleteValue();
  },
  handler<T = unknown>(handler: (source: Live<T>) => void) {
    return handler;
  },
};
