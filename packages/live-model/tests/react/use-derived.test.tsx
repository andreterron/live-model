/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  type Live,
  LiveHookReturn,
  useDerived,
  useDerivedValue,
  useLiveState,
} from '../../src/index.js';
import {
  clearWebSocketData,
  mockWebSocketData,
} from '../test-utils/mock-web-socket-transport.js';
import { RefObject } from 'react';

describe('react useDerived', () => {
  let liveState: RefObject<LiveHookReturn<number>>;

  beforeEach(() => {
    mockWebSocketData({ one: 1 });
    const { result } = renderHook(() => useLiveState<number>('one'));
    liveState = result;
  });

  afterEach(() => {
    clearWebSocketData();
  });

  test('can define a transformation function based on a dependency', async () => {
    const { result } = renderHook(() =>
      useDerived(liveState.current.live, (v) =>
        v.kind === 'value' ? { ...v, value: v.value + 1 } : v
      )
    );
    await waitFor(() => expect(result.current.value).toBe(2));
    expectTypeOf(result.current.value).toEqualTypeOf<number | undefined>();
  });

  test('can transform to another state', () => {
    const { result } = renderHook(() =>
      useDerived(liveState.current.live, () => ({
        kind: 'absent',
        reason: 'not_found',
      }))
    );

    expect(result.current.value).toBeUndefined();
    expect(result.current.live.get()).toMatchObject({
      kind: 'absent',
      reason: 'not_found',
    });
  });

  test('can define a setter', () => {
    const setValue = vitest.fn();
    const { result } = renderHook(() =>
      useDerivedValue(
        liveState.current.live,
        (v) => (v === undefined ? undefined : v + 1),
        { set_value: setValue }
      )
    );
    act(() => result.current.setValue(5));
    expect(setValue).toHaveBeenCalledWith(liveState.current.live, 5);
  });

  test('preserves typed custom operation handlers', () => {
    const increment = vitest.fn((source: Live<number>, amount: number) => {
      source.setValue(amount);
    });
    const reset = vitest.fn((source: Live<number>) => {
      void source;
    });
    const { result } = renderHook(() =>
      useDerivedValue(liveState.current.live, (value) => value, {
        increment,
        reset,
      })
    );

    const typedLive: Live<
      number,
      {
        increment: { data: number };
        reset: object;
      }
    > = result.current.live;

    act(() => {
      typedLive.op('increment', 2);
      typedLive.op('reset');
    });

    expect(increment).toHaveBeenCalledWith(liveState.current.live, 2);
    expect(reset).toHaveBeenCalledWith(liveState.current.live);
  });

  test.todo('can depend on multiple lives');
  test.todo('can map to another live');
});
