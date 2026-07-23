import { allKeysKey } from '@live-model/protocol';
import {
  BackendLiveModel,
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

describe('BackendLiveModel', () => {
  test('returns one canonical Live for each key', () => {
    const liveModel = new BackendLiveModel(createStorage());

    expect(liveModel.forKey('foo')).toBe(liveModel.forKey('foo'));
    expect(liveModel.forKey('foo')).not.toBe(liveModel.forKey('bar'));
  });

  test('persists direct Live mutations and notifies subscribers', () => {
    const storage = createStorage();
    const liveModel = new BackendLiveModel(storage);
    const states: unknown[] = [];
    const live = liveModel.forKey<{ count: number }>('foo');
    live.subscribe({ next: (state) => states.push(state) });

    live.setValue({ count: 1 });
    live.deleteValue();

    expect(states).toEqual([
      { kind: 'absent', reason: 'not_found' },
      { kind: 'value', value: { count: 1 } },
      { kind: 'absent', reason: 'deleted' },
    ]);
    expect(storage.get('foo')).toEqual({
      kind: 'absent',
      reason: 'not_found',
    });
  });

  test('updates the derived all-keys Live when membership changes', () => {
    const liveModel = new BackendLiveModel(createStorage());
    const states: unknown[] = [];
    liveModel.forKey<string[]>(allKeysKey).subscribe({
      next: (state) => states.push(state),
    });

    liveModel.forKey('foo').setValue({ count: 1 });
    liveModel.forKey('foo').setValue({ count: 2 });
    liveModel.forKey('foo').deleteValue();

    expect(states).toEqual([
      { kind: 'value', value: [] },
      { kind: 'value', value: ['foo'] },
      { kind: 'value', value: [] },
    ]);
  });

  test('rejects operations on the reserved all-keys Live', () => {
    const liveModel = new BackendLiveModel(createStorage());

    expect(
      liveModel.processOperation(allKeysKey, { type: 'delete' })
    ).toMatchObject({ status: 'error' });
  });
});
