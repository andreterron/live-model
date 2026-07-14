/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  LiveHookWithDefaultReturn,
  Live,
  useLiveState,
} from '../../src/index.js';
import {
  clearWebSocketData,
  mockWebSocketData,
} from '../test-utils/mock-web-socket-transport.js';

function getLive<T extends LiveHookWithDefaultReturn<any>>(
  render: () => T
): T['live'] {
  return renderHook(render).result.current.live;
}

describe('react useLiveState', () => {
  beforeEach(() => {
    mockWebSocketData({ one: 1 });
  });

  afterEach(() => {
    clearWebSocketData();
  });

  test('unitialized key returns undefined', async () => {
    let { result } = renderHook(() => useLiveState('unknown_key'));
    expect(result.current.value).toBeUndefined();
  });

  test('existing keys return their value', async () => {
    let { result } = renderHook(() => useLiveState('one'));

    await waitFor(() => expect(result.current.value).toBe(1));
  });

  test('null is preserved when a default value is provided', async () => {
    mockWebSocketData({ nullable: null });
    const { result } = renderHook(() => useLiveState('nullable', 'fallback'));

    await waitFor(() => expect(result.current.value).toBeNull());
  });

  test('websocket lives start as loading before the server state arrives', async () => {
    let { result } = renderHook(() => useLiveState('one'));

    expect(result.current.live.get()).toEqual({ kind: 'loading' });

    await waitFor(() => expect(result.current.value).toBe(1));
  });

  test('values can be set', async () => {
    let { result } = renderHook(() => useLiveState('one'));
    await waitFor(() => expect(result.current.value).toBe(1));

    act(() => result.current.setValue(2));

    await waitFor(() => expect(result.current.value).toBe(2));
  });

  describe('type inferred', () => {
    test('with no defaultValue returns Live<unknown>', () => {
      const live = getLive(() => useLiveState('one'));
      expectTypeOf(live).toEqualTypeOf<Live<unknown>>();
    });

    test('with no defaultValue returns an unknown or undefined value', () => {
      const { result } = renderHook(() => useLiveState('one'));
      expectTypeOf(result.current.value).toEqualTypeOf<unknown | undefined>();
    });

    test('with defaultValue returns Live<typeof defaultValue>', () => {
      const live = getLive(() => useLiveState('one', 0));
      expectTypeOf(live).toEqualTypeOf<Live<number>>();
    });

    test('with defaultValue returns a value that can be undefined', () => {
      const { result } = renderHook(() => useLiveState('one', 0));
      expectTypeOf(result.current.value).toEqualTypeOf<number>();
    });
  });

  describe('type specified', () => {
    test('with no defaultValue returns Live<T | undefined>', () => {
      const live = getLive(() => useLiveState<number>('one'));
      expectTypeOf(live).toEqualTypeOf<Live<number>>();
    });

    test('with no defaultValue returns T or undefined value', () => {
      const { result } = renderHook(() => useLiveState<number>('one'));
      expectTypeOf(result.current.value).toEqualTypeOf<number | undefined>();
    });

    test('with defaultValue returns Live<T>', () => {
      const live = getLive(() => useLiveState<number>('one', 0));
      expectTypeOf(live).toEqualTypeOf<Live<number>>();
    });

    test('with defaultValue returns T or undefined value', () => {
      const { result } = renderHook(() => useLiveState<number>('one', 0));
      expectTypeOf(result.current.value).toEqualTypeOf<number>();
    });
  });
});
