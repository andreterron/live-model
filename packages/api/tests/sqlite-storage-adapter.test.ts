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
});
