import { StorageLive, type StorageAdapter } from '../src/index.js';

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
});
