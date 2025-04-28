/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import {
  HookReturn,
  SettableMemoryLive,
  useLiveState,
  useSubscribe,
} from '../../src/index.js';
import { clearData, mockData } from '../test-utils/mock-data.js';
import { RefObject } from 'react';

describe('react useSubscribe', () => {
  let liveState: RefObject<HookReturn<number>>;

  beforeEach(() => {
    mockData({ one: 1 });
    let { result } = renderHook(() => useLiveState<number>('one', 1));
    liveState = result;
  });

  afterEach(() => {
    clearData();
  });

  test('can subscribe to a live', async () => {
    let { result } = renderHook(() => useSubscribe(liveState.current.live));
    expect(result.current.value).toBe(1);
  });

  test.todo('can get updates from a live');

  test('only renders once with comparable values', async () => {
    const renderSpy = vitest.fn();
    let { result } = renderHook(() => {
      renderSpy();
      return useSubscribe(liveState.current.live);
    });
    expect(result.current.value).toBe(1);
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
