import {
  liveReference,
  OperationSetRegistry,
  reduceTypeOperation,
} from 'live-model';
import { describe, expect, test } from 'vitest';

import { counterOperationSet, multisetOperationSet } from './operation-sets';

describe('counterOperationSet', () => {
  test('increments and resets the counter', () => {
    expect(
      reduceTypeOperation(counterOperationSet, 2, {
        type: 'increment',
        data: 3,
      })
    ).toBe(5);
    expect(reduceTypeOperation(counterOperationSet, 5, { type: 'reset' })).toBe(
      0
    );
  });
});

describe('multisetOperationSet', () => {
  const registry = new OperationSetRegistry().register(multisetOperationSet);

  test('inserts duplicate references and removes one occurrence', () => {
    const first = liveReference('todos/first');
    const second = liveReference('todos/second');

    expect(
      registry.process(
        {
          kind: 'value',
          value: [first],
          metadata: { op_set: { root: 'multiset' } },
        },
        { type: 'insert', data: first },
        { key: 'inbox' }
      )
    ).toEqual({
      status: 'success',
      effects: [{ type: 'set', key: 'inbox', value: [first, first] }],
    });

    expect(
      registry.process(
        {
          kind: 'value',
          value: [first, first, second],
          metadata: { op_set: { root: 'multiset' } },
        },
        { type: 'remove', data: first },
        { key: 'inbox' }
      )
    ).toEqual({
      status: 'success',
      effects: [{ type: 'set', key: 'inbox', value: [first, second] }],
    });
  });

  test('rejects pointers because membership is entity-level', () => {
    expect(
      registry.process(
        {
          kind: 'value',
          value: [],
          metadata: { op_set: { root: 'multiset' } },
        },
        { type: 'insert', data: liveReference('todos/first', '/title') },
        { key: 'inbox' }
      )
    ).toMatchObject({
      status: 'error',
      error: { code: 'invalid_operation' },
    });
  });
});
