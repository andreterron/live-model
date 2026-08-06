import { liveReference } from 'live-model';
import { BackendLiveModel, type Live } from 'live-model';
import { SQLiteStorageAdapter } from '../src/storage-adapter/sqlite-storage-adapter.js';

describe('SQLiteStorageAdapter', () => {
  test('gets, sets, lists, and deletes values', () => {
    const storage = new SQLiteStorageAdapter(':memory:');

    expect(storage.get('foo')).toEqual({
      kind: 'absent',
      reason: 'not_found',
    });
    expect(storage.set('foo', { count: 1 })).toBe(true);
    expect(storage.set('bar', null)).toBe(true);
    expect(storage.get('foo')).toEqual({
      kind: 'value',
      value: { count: 1 },
      metadata: {},
    });
    expect(storage.listKeys()).toEqual(['bar', 'foo']);

    expect(storage.delete('foo')).toBe(true);
    expect(storage.get('foo')).toEqual({
      kind: 'absent',
      reason: 'not_found',
    });
  });

  test('rejects values that cannot be serialized', () => {
    const storage = new SQLiteStorageAdapter(':memory:');

    expect(storage.set('foo', undefined)).toBe(false);
    expect(storage.listKeys()).toEqual([]);
  });

  test('stores metadata beside values and preserves it across value updates', () => {
    const storage = new SQLiteStorageAdapter(':memory:');
    storage.set('counter', 1);

    expect(
      storage.setMetadata('counter', {
        op_set: { root: 'counter@1' },
      })
    ).toBe(true);
    expect(storage.set('counter', 2)).toBe(true);
    expect(storage.get('counter')).toEqual({
      kind: 'value',
      value: 2,
      metadata: { op_set: { root: 'counter@1' } },
    });
  });

  test('keeps references materialized in SQLite while Lives resolve them', () => {
    const storage = new SQLiteStorageAdapter(':memory:');
    const liveModel = new BackendLiveModel(storage);
    const author = liveModel.forKey<{ name: string }>('people.ada');
    const post = liveModel.forKey<{ author: Live<{ name: string }> }>(
      'posts.first'
    );

    post.setValue({ author });

    expect(storage.get('posts.first')).toEqual({
      kind: 'value',
      value: { author: liveReference('people.ada') },
      metadata: {},
    });
    expect(post.get()).toEqual({
      kind: 'value',
      value: { author },
      metadata: {},
    });
  });
});
