import { z } from 'zod';
import {
  buildType,
  OperationSetRegistry,
  StorageLive,
  type Operation,
  type StorageAdapter,
} from '../src/index.js';

function createStorage(): StorageAdapter {
  const values = new Map<string, unknown>();
  const metadata = new Map<string, object>();

  return {
    get(key) {
      return values.has(key)
        ? {
            kind: 'value',
            value: values.get(key),
            metadata: metadata.get(key) ?? {},
          }
        : { kind: 'absent', reason: 'not_found' };
    },
    listKeys() {
      return [...values.keys()].sort();
    },
    set(key, data) {
      values.set(key, data);
      return true;
    },
    setMetadata(key, value) {
      if (!values.has(key)) return false;
      metadata.set(key, value);
      return true;
    },
    delete(key) {
      values.delete(key);
      return true;
    },
  };
}

describe('StorageLive', () => {
  test('owns persistence and publishes operation results', () => {
    const storage = createStorage();
    const states: unknown[] = [];
    const live = new StorageLive<{ count: number }>('counter', storage);
    live.subscribe({ next: (state) => states.push(state) });

    expect(live.op({ type: 'set_value', data: { count: 1 } })).toEqual({
      status: 'success',
    });
    expect(storage.get('counter')).toEqual({
      kind: 'value',
      value: { count: 1 },
      metadata: {},
    });
    expect(states).toEqual([
      { kind: 'absent', reason: 'not_found' },
      { kind: 'value', value: { count: 1 }, metadata: {} },
    ]);
  });

  test('reports persistence failures without publishing state', () => {
    const storage = createStorage();
    storage.set = () => false;
    const states: unknown[] = [];
    const live = new StorageLive('counter', storage);
    live.subscribe({ next: (state) => states.push(state) });

    expect(live.op('set_value', 1)).toEqual({
      status: 'error',
      error: {
        code: 'operation_failed',
        message: 'Operation could not be persisted',
      },
    });
    expect(states).toEqual([{ kind: 'absent', reason: 'not_found' }]);
  });

  test('rejects unregistered custom operations without replacing state', () => {
    const storage = createStorage();
    storage.set('items', ['first']);
    const live = new StorageLive<unknown[], Operation>('items', storage);

    expect(live.op({ type: 'append', data: 'second' })).toMatchObject({
      status: 'error',
      error: { code: 'unsupported_operation' },
    });
    expect(storage.get('items')).toEqual({
      kind: 'value',
      value: ['first'],
      metadata: {},
    });
  });

  test('always supports persisted metadata updates', () => {
    const storage = createStorage();
    storage.set('counter', 1);
    const live = new StorageLive<number, { type: 'increment'; data: number }>(
      'counter',
      storage
    );

    live.setMetadata({ op_set: { root: 'counter' } });

    expect(live.get()).toEqual({
      kind: 'value',
      value: 1,
      metadata: { op_set: { root: 'counter' } },
    });
  });

  test('selects a registered operation set from current metadata', () => {
    const storage = createStorage();
    storage.set('counter', 1);
    storage.setMetadata('counter', { op_set: { root: 'counter' } });
    const counter = buildType('counter').operation(
      'increment',
      z.number(),
      (state: number, amount) => state + amount
    );
    const registry = new OperationSetRegistry().register(counter);
    const live = new StorageLive<number, Operation>('counter', storage, {
      operationSetRegistry: registry,
    });

    expect(live.op({ type: 'increment', data: 2 })).toEqual({
      status: 'success',
    });
    expect(live.get()).toEqual({
      kind: 'value',
      value: 3,
      metadata: { op_set: { root: 'counter' } },
    });
    expect(live.op({ type: 'set_value', data: 10 })).toMatchObject({
      status: 'error',
      error: { code: 'unsupported_operation' },
    });
    expect(live.op({ type: 'delete' })).toMatchObject({
      status: 'error',
      error: { code: 'unsupported_operation' },
    });
  });

  test('resolves metadata again after the operation-set assignment changes', () => {
    const storage = createStorage();
    storage.set('counter', 1);
    storage.setMetadata('counter', { op_set: { root: 'counter' } });
    const counter = buildType('counter').operation(
      'increment',
      z.number(),
      (state: number, amount) => state + amount
    );
    const frozenCounter = buildType('frozen-counter').operation(
      'increment',
      z.number()
    );
    const registry = new OperationSetRegistry()
      .register(counter)
      .register(frozenCounter);
    const live = new StorageLive<number, Operation>('counter', storage, {
      operationSetRegistry: registry,
    });

    expect(live.op({ type: 'increment', data: 1 })).toEqual({
      status: 'success',
    });
    live.setMetadata({ op_set: { root: 'frozen-counter' } });
    expect(live.op({ type: 'increment', data: 1 })).toEqual({
      status: 'success',
    });
    expect(live.get()).toEqual({
      kind: 'value',
      value: 2,
      metadata: { op_set: { root: 'frozen-counter' } },
    });
  });

  test('runs explicitly registered set and delete handlers', () => {
    const storage = createStorage();
    storage.set('value', 1);
    storage.setMetadata('value', { op_set: { root: 'mutable-number' } });
    const mutableNumber = buildType('mutable-number')
      .operation('set_value', z.number(), (_state: number, value) => value)
      .operation('delete');
    const registry = new OperationSetRegistry().register(mutableNumber, {
      delete: (_state, _operation, context) => ({
        effects: [{ type: 'delete', key: context.key }],
      }),
    });
    const live = new StorageLive<number, Operation>('value', storage, {
      operationSetRegistry: registry,
    });

    expect(live.op({ type: 'set_value', data: 2 })).toEqual({
      status: 'success',
    });
    expect(live.get()).toEqual({
      kind: 'value',
      value: 2,
      metadata: { op_set: { root: 'mutable-number' } },
    });
    expect(live.op({ type: 'delete' })).toEqual({ status: 'success' });
    expect(live.get()).toEqual({ kind: 'absent', reason: 'not_found' });
  });
});
