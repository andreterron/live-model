/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import {
  LiveHookWithDefaultReturn,
  SettableMemoryLive,
  useLiveState,
  useSubscribe,
} from '../../src/index.js';
import {
  clearWebSocketData,
  mockWebSocketData,
} from '../test-utils/mock-web-socket-transport.js';
import { RefObject } from 'react';

describe('react useSubscribe', () => {
  let liveState: RefObject<LiveHookWithDefaultReturn<number>>;

  beforeEach(() => {
    mockWebSocketData({ one: 1 });
    let { result } = renderHook(() => useLiveState<number>('one', 1));
    liveState = result;
  });

  afterEach(() => {
    clearWebSocketData();
  });

  test('can subscribe to a live', async () => {
    let { result } = renderHook(() => useSubscribe(liveState.current.live));
    await waitFor(() => expect(result.current.value).toBe(1));
    expectTypeOf(result.current.value).toEqualTypeOf<number | undefined>();
  });

  test.todo('can get updates from a live');

  test('only renders once with comparable values', async () => {
    const renderSpy = vitest.fn();
    let { result } = renderHook(() => {
      renderSpy();
      return useSubscribe(liveState.current.live);
    });
    await waitFor(() => expect(result.current.value).toBe(1));
    expect(renderSpy).toHaveBeenCalledOnce();
  });

  test('only renders once with non-comparable values', async () => {
    const renderSpy = vitest.fn();
    const live = new SettableMemoryLive(NaN);
    let { result } = renderHook(() => {
      renderSpy();
      return useSubscribe(live);
    });
    expect(result.current.value).toBe(NaN);
    expect(renderSpy).toHaveBeenCalledOnce();
  });
});
