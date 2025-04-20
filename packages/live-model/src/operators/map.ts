import { Live } from '../live.js';
import { LiveSetter } from '../setter.js';

export function map<T, U>(
  live: Live<T>,
  transform: (v: T) => U,
  setter?: LiveSetter<T, U>
): Live<U> {
  return {
    get: () => transform(live.get()),
    setValue: (u: U) => {
      if (!setter) {
        // no-op
        return;
      }

      setter(u, live);
    },
  };
}
