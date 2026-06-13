import { useCallback, useMemo } from 'react';
import { Live } from '../live.js';
import { LiveHookReturn } from './hook-types.js';
import { LiveSetter } from '../setter.js';
import { map } from '../operators/map.js';
import { LiveDeleter } from '../deleter.js';

/**
 * @param live source of values
 * @param transform function that transforms the value from source to destination
 * @param setter use setter.noop (=== undefined), setter.passthrough(), setter.transform(_) or setter.handler(_).
 * NOTE: Updating this parameter will not update the setter for the derived value. If you need that, please create a GitHub issue.
 * @param deleter use deleter.noop (=== undefined), deleter.passthrough() or deleter.handler(_).
 * NOTE: Updating this parameter will not update the deleter for the derived value. If you need that, please create a GitHub issue.
 */
export function useDerived<T, U>(
  live: Live<T>,
  transform: (value: T) => U,
  setter?: LiveSetter<T, U>,
  deleter?: LiveDeleter<T>
): LiveHookReturn<U> {
  const derived: Live<U> = useMemo(
    () => map(live, transform, setter, deleter),
    [live]
  );

  const state = derived.get();
  const setValue = useCallback((u: U) => derived.setValue(u), [derived]);
  const deleteValue = useCallback(() => derived.deleteValue(), [derived]);

  return {
    value: state.kind === 'value' ? state.value : undefined,
    setValue,
    deleteValue,
    live: derived,
  };
}
