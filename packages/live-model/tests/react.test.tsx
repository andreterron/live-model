/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useLiveState } from '../src/index.js';
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
      let { result } = renderHook(() => useLiveState('unknown_key'));
      expect(result.current.value).toBeUndefined();
    });

    test('existing keys return their value', async () => {
      let { result } = renderHook(() => useLiveState('one'));

      expect(result.current.value).toBe(1);
    });

    test('values can be set', async () => {
      let { result } = renderHook(() => useLiveState('one'));
      expect(result.current.value).toBe(1);

      act(() => result.current.setValue(2));

      expect(result.current.value).toBe(2);
    });
  });
});
