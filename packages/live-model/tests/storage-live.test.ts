import {
  StorageLive,
  type Operation,
  type StorageAdapter,
} from '../src/index.js';

function createStorage(): StorageAdapter {
  const values = new Map<string, unknown>();

  return {
    get(key) {
      return values.has(key)
        ? { kind: 'value', value: values.get(key) }
        : { kind: 'absent', reason: 'not_found' };
    },
    listKeys() {
      return [...values.keys()].sort();
    },
    set(key, data) {
      values.set(key, data);
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
    });
    expect(states).toEqual([
      { kind: 'absent', reason: 'not_found' },
      { kind: 'value', value: { count: 1 } },
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

  test('applies registered custom operations to the current state', () => {
    const storage = createStorage();
    storage.set('items', ['first']);
    const states: unknown[] = [];
    const live = new StorageLive<unknown[], { type: 'append'; data: string }>(
      'items',
      storage,
      {
        operationHandlers: {
          append(currentState, operation) {
            if (
              currentState.kind !== 'value' ||
              !Array.isArray(currentState.value) ||
              typeof operation.data !== 'string'
            ) {
              return {
                status: 'error',
                error: {
                  code: 'invalid_state',
                  message: 'append requires an array value',
                },
              };
            }

            return {
              status: 'success',
              action: 'set',
              value: [...currentState.value, operation.data],
            };
          },
        },
      }
    );
    live.subscribe({ next: (state) => states.push(state) });

    expect(live.op({ type: 'append', data: 'second' })).toEqual({
      status: 'success',
    });
    expect(storage.get('items')).toEqual({
      kind: 'value',
      value: ['first', 'second'],
    });
    expect(states[states.length - 1]).toEqual({
      kind: 'value',
      value: ['first', 'second'],
    });
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
    });
  });
});
