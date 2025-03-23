/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useData } from '../src/index.js';
import { clearData, mockData } from './test-utils/mock-data.js';

describe('react', () => {
  describe('hook', () => {
    afterEach(() => {
      clearData();
    });

    test('unitialized key returns undefined', async () => {
      let { result } = renderHook(() => useData('unknown_key'));
      expect(result.current.value).toBeUndefined();
    });

    test('existing keys return their value', async () => {
      mockData({ key: 7 });

      let { result } = renderHook(() => useData('key'));

      expect(result.current.value).toBe(7);
    });

    test('values can be set', async () => {
      mockData({ counter: 0 });

      let { result } = renderHook(() => useData('counter'));

      expect(result.current.value).toBe(0);

      act(() => result.current.set(1));

      expect(result.current.value).toBe(1);
    });

    test('values can be deleted', async () => {
      mockData({ key: 7 });

      let { result } = renderHook(() => useData('key'));

      expect(result.current.value).toBe(7);

      act(() => result.current.delete());

      expect(result.current.value).toBe(undefined);
    });
  });
});
