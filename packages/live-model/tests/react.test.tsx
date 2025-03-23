/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { useData } from '../src/lib/index.js';

describe('react', () => {
  describe('hook', () => {
    test('unitialized key returns undefined', async () => {
      let {
        result: { current: data },
      } = renderHook(() => useData('unknown_key'));
      expect(data.value).toBeUndefined();
    });
  });
});
