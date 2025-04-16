import { useCallback, useMemo } from 'react';
import { Live } from '../live.js';
import { HookReturn } from './hook-types.js';
import { LiveSetter } from '../setter.js';

/**
 * @param live source of values
 * @param transform function that transforms the value from source to destination
 * @param setter use setter.noop (=== undefined), setter.passthrough(), setter.transform(_) or setter.handler(_).
 * NOTE: Updating this parameter will not update the setter for the derived value. If you need that, please create a GitHub issue.
 */
export function useDerived<T, U>(
  live: Live<T>,
  transform: (value: T | undefined) => U,
  setter?: LiveSetter<T, U>
): HookReturn<U> {
  const v = live.get();
  const u = useMemo(() => {
    return transform(v);
  }, [v]);

  const setValue = useCallback(
    (u: U) => {
      if (!setter) {
        // no-op
        return;
      }

      setter(u, live);
    },
    [live]
  );

  const derived: Live<U> = useMemo(
    () => ({
      get: () => u,
      setValue,
    }),
    [u, setValue]
  );

  return {
    value: u,
    setValue,
    live: derived,
  };
}
