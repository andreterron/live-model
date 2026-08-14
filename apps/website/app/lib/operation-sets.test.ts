import { reduceTypeOperation } from 'live-model';
import { describe, expect, test } from 'vitest';

import { counterOperationSet } from './operation-sets';

describe('counterOperationSet', () => {
  test('increments and resets the counter', () => {
    expect(
      reduceTypeOperation(counterOperationSet, 2, {
        type: 'increment',
        data: 3,
      })
    ).toBe(5);
    expect(
      reduceTypeOperation(counterOperationSet, 5, { type: 'reset' })
    ).toBe(0);
  });
});
