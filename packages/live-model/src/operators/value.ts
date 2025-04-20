import { Live } from '../live.js';

export function value<T>(value: T, setter?: (value: T) => void): Live<T> {
  return {
    get: () => value,
    setValue: (v: T) => {
      if (!setter) {
        // no-op
        return;
      }

      setter(v);
    },
  };
}
