/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { HookReturn, useDerived, useLiveState } from '../../src/index.js';
import { clearData, mockData } from '../test-utils/mock-data.js';
import { RefObject } from 'react';

describe('react useDerived', () => {
  let liveState: RefObject<HookReturn<number | undefined>>;

  beforeEach(() => {
    mockData({ one: 1 });
    let { result } = renderHook(() => useLiveState<number>('one'));
    liveState = result;
  });

  afterEach(() => {
    clearData();
  });

  test('can define a transformation function based on a dependency', async () => {
    let { result } = renderHook(() =>
      useDerived(liveState.current.live, (v) =>
        v === undefined ? undefined : v + 1
      )
    );
    expect(result.current.value).toBe(2);
  });

  test('can define a setter', () => {
    let aSetter = vitest.fn();
    let { result } = renderHook(() =>
      useDerived(
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
