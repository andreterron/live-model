import { useMemo } from 'react';
import type { LiveState } from '@live-model/protocol';
import { Live } from '../live.js';
import { LiveHookReturn } from './hook-types.js';
import {
  type DerivedOperationHandlerMap,
  mapState,
  type OperationsFromHandlers,
  valueTransform,
} from '../operators/map.js';
import { useSubscribe } from './use-subscribe.js';

/**
 * @param live source of values
 * @param transform function that transforms the source state to the destination state
 * @param operationHandlers map operation names to handlers; handlers receive source first and optional operation data second
 */
export function useDerived<T, U, H extends DerivedOperationHandlerMap>(
  live: Live<T>,
  transform: (state: LiveState<T>) => LiveState<U>,
  operationHandlers: H
): LiveHookReturn<U, OperationsFromHandlers<H>>;
export function useDerived<T, U>(
  live: Live<T>,
  transform: (state: LiveState<T>) => LiveState<U>
): LiveHookReturn<U, Record<never, never>>;
export function useDerived<T, U>(
  live: Live<T>,
  transform: (state: LiveState<T>) => LiveState<U>,
  operationHandlers?: DerivedOperationHandlerMap
): any {
  const derived = useMemo(
    () => mapState(live, transform, operationHandlers ?? {}),
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
 * @param operationHandlers map operation names to handlers; handlers receive source first and optional operation data second
 */
export function useDerivedValue<T, U, H extends DerivedOperationHandlerMap>(
  live: Live<T>,
  transform: (value: T) => U,
  operationHandlers: H
): LiveHookReturn<U, OperationsFromHandlers<H>>;
export function useDerivedValue<T, U>(
  live: Live<T>,
  transform: (value: T) => U
): LiveHookReturn<U, Record<never, never>>;
export function useDerivedValue<T, U>(
  live: Live<T>,
  transform: (value: T) => U,
  operationHandlers?: DerivedOperationHandlerMap
): any {
  return useDerived(live, valueTransform(transform), operationHandlers ?? {});
}
