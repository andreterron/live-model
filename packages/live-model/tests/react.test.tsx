/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useData } from '../src/index.js';
import { clearData, mockData } from './test-utils/mock-data.js';

describe('react', () => {
  describe('hook', () => {
    beforeEach(() => {
      mockData({ one: 1 });
    });

    afterEach(() => {
      clearData();
    });

    test('unitialized key returns undefined', async () => {
      let { result } = renderHook(() => useData('unknown_key'));
      expect(result.current.value).toBeUndefined();
    });

    test('existing keys return their value', async () => {
      let { result } = renderHook(() => useData('one'));

      expect(result.current.value).toBe(1);
    });

    test('values can be set', async () => {
      let { result } = renderHook(() => useData('one'));
      expect(result.current.value).toBe(1);

      act(() => result.current.set(2));

      expect(result.current.value).toBe(2);
    });

    test('values can be deleted', async () => {
      let { result } = renderHook(() => useData('one'));
      expect(result.current.value).toBe(1);

      act(() => result.current.delete());

      expect(result.current.value).toBe(undefined);
    });
  });
});
