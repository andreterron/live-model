import { z } from 'zod';
import {
  buildType,
  OperationSetRegistry,
  type LiveState,
} from '../src/index.js';

describe('OperationSetRegistry', () => {
  test('automatically registers and selects the default operation set', () => {
    const registry = new OperationSetRegistry();

    expect(registry.has('default')).toBe(true);
    expect(
      registry.process(
        { kind: 'absent', reason: 'not_found' },
        { type: 'set_value', data: 'created' },
        { key: 'entry' }
      )
    ).toEqual({
      status: 'success',
      effects: [{ type: 'set', key: 'entry', value: 'created' }],
    });
    expect(
      registry.process(
        { kind: 'value', value: 'created', metadata: {} },
        { type: 'delete' },
        { key: 'entry' }
      )
    ).toEqual({
      status: 'success',
      effects: [{ type: 'delete', key: 'entry' }],
    });
  });

  test('lists registered definitions for operation-driven clients', () => {
    const counter = buildType('counter').operation('increment', z.number());
    const registry = new OperationSetRegistry().register(counter);

    expect(registry.list().map(({ name }) => name)).toEqual([
      'default',
      'counter',
    ]);
  });

  test('validates and reduces operations with a registered definition', () => {
    const counter = buildType('counter').operation(
      'increment',
      z.coerce.number(),
      (state: number, amount) => state + amount
    );
    const registry = new OperationSetRegistry().register(counter);
    const state: LiveState<number> = {
      kind: 'value',
      value: 3,
      metadata: { op_set: { root: 'counter' } },
    };

    expect(
      registry.process(
        state,
        {
          type: 'increment',
          data: '2',
        },
        { key: 'counter' }
      )
    ).toEqual({
      status: 'success',
      effects: [{ type: 'set', key: 'counter', value: 5 }],
    });
  });

  test('returns unchanged when an operation has no reducer or handler', () => {
    const events = buildType('events').operation('record', z.string());
    const registry = new OperationSetRegistry().register(events);

    expect(
      registry.process(
        {
          kind: 'value',
          value: [],
          metadata: { op_set: { root: 'events' } },
        },
        { type: 'record', data: 'seen' },
        { key: 'events' }
      )
    ).toEqual({ status: 'success', effects: [] });
  });

  test('supports explicit handlers for non-value effects', () => {
    const removable = buildType('removable').operation('delete');
    const registry = new OperationSetRegistry().register(removable, {
      delete: (_state, _operation, context) => ({
        effects: [{ type: 'delete', key: context.key }],
      }),
    });

    expect(
      registry.process(
        {
          kind: 'value',
          value: 'present',
          metadata: { op_set: { root: 'removable' } },
        },
        { type: 'delete' },
        { key: 'entry' }
      )
    ).toEqual({
      status: 'success',
      effects: [{ type: 'delete', key: 'entry' }],
    });
  });

  test('distinguishes unknown sets, unsupported operations, and invalid data', () => {
    const counter = buildType('counter').operation('increment', z.number());
    const registry = new OperationSetRegistry().register(counter);
    const state: LiveState<number> = {
      kind: 'value',
      value: 1,
      metadata: { op_set: { root: 'counter' } },
    };

    expect(
      registry.process(
        { ...state, metadata: { op_set: { root: 'missing' } } },
        { type: 'increment', data: 1 },
        { key: 'counter' }
      )
    ).toMatchObject({
      status: 'error',
      error: { code: 'unknown_operation_set' },
    });
    expect(
      registry.process(
        state,
        { type: 'set_value', data: 2 },
        { key: 'counter' }
      )
    ).toMatchObject({
      status: 'error',
      error: { code: 'unsupported_operation' },
    });
    expect(
      registry.process(
        state,
        {
          type: 'increment',
          data: 'invalid',
        },
        { key: 'counter' }
      )
    ).toMatchObject({
      status: 'error',
      error: { code: 'invalid_operation' },
    });
  });

  test('rejects duplicate IDs and handlers for undefined operations', () => {
    const counter = buildType('counter').operation('increment', z.number());
    const registry = new OperationSetRegistry().register(counter);

    expect(() => registry.register(counter)).toThrow(
      'Operation set "counter" is already registered'
    );
    expect(() =>
      new OperationSetRegistry().register(counter, {
        missing: () => ({ effects: [] }),
      } as never)
    ).toThrow('Handler "missing" is not defined by operation set "counter"');
  });
});
