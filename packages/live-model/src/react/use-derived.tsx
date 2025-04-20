import { useCallback, useMemo } from 'react';
import { Live } from '../live.js';
import { HookReturn } from './hook-types.js';
import { LiveSetter } from '../setter.js';
import { map } from '../operators/map.js';

/**
 * @param live source of values
 * @param transform function that transforms the value from source to destination
 * @param setter use setter.noop (=== undefined), setter.passthrough(), setter.transform(_) or setter.handler(_).
 * NOTE: Updating this parameter will not update the setter for the derived value. If you need that, please create a GitHub issue.
 */
export function useDerived<T, U>(
  live: Live<T>,
  transform: (value: T) => U,
  setter?: LiveSetter<T, U>
): HookReturn<U> {
  const derived: Live<U> = useMemo(() => map(live, transform, setter), [live]);

  const value = derived.get();
  const setValue = useCallback((u: U) => derived.setValue(u), [derived]);

  return {
    value,
    setValue,
    live: derived,
  };
}
