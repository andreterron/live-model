import { useCallback, useMemo } from 'react';
import type { LiveState } from '@live-model/protocol';
import { Live } from '../live.js';
import { LiveHookReturn } from './hook-types.js';
import { LiveSetter } from '../setter.js';
import { mapState, valueTransform } from '../operators/map.js';
import { LiveDeleter } from '../deleter.js';
import { useSubscribe } from './use-subscribe.js';

/**
 * @param live source of values
 * @param transform function that transforms the source state to the destination state
 * @param setter use setter.noop (=== undefined), setter.passthrough(), setter.transform(_) or setter.handler(_).
 * NOTE: Updating this parameter will not update the setter for the derived value. If you need that, please create a GitHub issue.
 * @param deleter use deleter.noop (=== undefined), deleter.passthrough() or deleter.handler(_).
 * NOTE: Updating this parameter will not update the deleter for the derived value. If you need that, please create a GitHub issue.
 */
export function useDerived<T, U>(
  live: Live<T>,
  transform: (state: LiveState<T>) => LiveState<U>,
  setter?: LiveSetter<T, U>,
  deleter?: LiveDeleter<T>
): LiveHookReturn<U> {
  const derived: Live<U> = useMemo(
    () => mapState(live, transform, setter, deleter),
    [live]
  );

  const { value, setValue, deleteValue } = useSubscribe(derived);

  return {
    value,
    setValue,
    deleteValue,
    live: derived,
  };
}

/**
 * @param live source of values
 * @param transform function that transforms source values to destination values
 * @param setter use setter.noop (=== undefined), setter.passthrough(), setter.transform(_) or setter.handler(_).
 * NOTE: Updating this parameter will not update the setter for the derived value. If you need that, please create a GitHub issue.
 * @param deleter use deleter.noop (=== undefined), deleter.passthrough() or deleter.handler(_).
 * NOTE: Updating this parameter will not update the deleter for the derived value. If you need that, please create a GitHub issue.
 */
export function useDerivedValue<T, U>(
  live: Live<T>,
  transform: (value: T) => U,
  setter?: LiveSetter<T, U>,
  deleter?: LiveDeleter<T>
): LiveHookReturn<U> {
  return useDerived(live, valueTransform(transform), setter, deleter);
}
