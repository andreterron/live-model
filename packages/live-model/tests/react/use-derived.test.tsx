/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import {
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
    let { result } = renderHook(() => useLiveState<number>('one'));
    liveState = result;
  });

  afterEach(() => {
    clearWebSocketData();
  });

  test('can define a transformation function based on a dependency', async () => {
    let { result } = renderHook(() =>
      useDerived(liveState.current.live, (v) =>
        v.kind === 'value' ? { ...v, value: v.value + 1 } : v
      )
    );
    await waitFor(() => expect(result.current.value).toBe(2));
    expectTypeOf(result.current.value).toEqualTypeOf<number | undefined>();
  });

  test('can transform to another state', () => {
    let { result } = renderHook(() =>
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
    let aSetter = vitest.fn();
    let { result } = renderHook(() =>
      useDerivedValue(
        liveState.current.live,
        (v) => (v === undefined ? undefined : v + 1),
        aSetter
      )
    );
    act(() => result.current.setValue(5));
    expect(aSetter).toHaveBeenCalledWith(5, liveState.current.live);
  });

  test.todo('can depend on multiple lives');
  test.todo('can map to another live');
});
