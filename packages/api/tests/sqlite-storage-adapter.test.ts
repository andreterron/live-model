import { liveReference } from 'live-model';
import { BackendLiveModel, type Live, type LiveFilter } from 'live-model';
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
        op_set: { root: 'counter' },
      })
    ).toBe(true);
    expect(storage.set('counter', 2)).toBe(true);
    expect(storage.get('counter')).toEqual({
      kind: 'value',
      value: 2,
      metadata: { op_set: { root: 'counter' } },
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

  test.each<[string, LiveFilter<unknown>, string[]]>([
    ['nested equality', { 'profile.name': 'Ada' }, ['people.ada']],
    ['numeric comparison', { score: { $gte: 10 } }, ['people.ada']],
    [
      'bounded numeric comparison',
      { score: { $gt: 10, $lte: 12 } },
      ['people.ada'],
    ],
    ['boolean inequality', { active: { $ne: false } }, ['people.ada']],
    ['membership', { status: { $in: ['active', 'paused'] } }, ['people.ada']],
    ['negative membership', { status: { $nin: ['archived'] } }, ['people.ada']],
    ['array contains', { tags: { $contains: 'typescript' } }, ['people.ada']],
    ['array index', { 'revisions.1': { $eq: 'final' } }, ['people.ada']],
    ['starts with', { title: { $startsWith: 'Intro' } }, ['people.ada']],
    [
      'case-insensitive contains',
      { title: { $containsText: { value: 'LIVE', caseSensitive: false } } },
      ['people.ada'],
    ],
    [
      'case-insensitive ends with',
      { title: { $endsWith: { value: 'MODEL', caseSensitive: false } } },
      ['people.ada'],
    ],
    [
      'boolean composition',
      { $and: [{ score: { $gt: 5 } }, { active: true }] },
      ['people.ada'],
    ],
    [
      'or composition',
      { $or: [{ score: { $lt: 5 } }, { active: true }] },
      ['people.ada', 'people.grace'],
    ],
    [
      'nor composition',
      { $nor: [{ score: { $lt: 5 } }, { active: false }] },
      ['people.ada'],
    ],
  ])('queries JSON values using %s', (_name, query, expectedKeys) => {
    const storage = queryStorage();

    expect(storage.queryKeys({ filter: query, limit: 100 })).toEqual({
      keys: expectedKeys,
      hasMore: false,
    });
  });

  test('caps a query result and reports additional matches', () => {
    const storage = queryStorage();

    expect(storage.queryKeys({ filter: {}, limit: 1 })).toEqual({
      keys: ['people.ada'],
      hasMore: true,
    });
  });

  test('returns query results through a Live', () => {
    const storage = queryStorage();
    const liveModel = new BackendLiveModel(storage);
    const states: unknown[] = [];

    liveModel.query({ filter: { active: true } }).subscribe({
      next: (state) => states.push(state),
    });

    expect(states).toEqual([
      { kind: 'loading' },
      {
        kind: 'value',
        value: {
          items: [
            {
              key: 'people.ada',
              state: {
                kind: 'value',
                value: {
                  profile: { name: 'Ada' },
                  score: 12,
                  status: 'active',
                  tags: ['typescript', 'data'],
                  revisions: ['draft', 'final'],
                  title: 'Introduction to Live Model',
                  active: true,
                },
                metadata: {},
              },
            },
          ],
          range: { hasMore: false },
        },
        metadata: {},
      },
    ]);
  });
});

function queryStorage(): SQLiteStorageAdapter {
  const storage = new SQLiteStorageAdapter(':memory:');
  storage.set('people.ada', {
    profile: { name: 'Ada' },
    score: 12,
    status: 'active',
    tags: ['typescript', 'data'],
    revisions: ['draft', 'final'],
    title: 'Introduction to Live Model',
    active: true,
  });
  storage.set('people.grace', {
    profile: { name: 'Grace' },
    score: 4,
    status: 'archived',
    tags: ['systems'],
    revisions: ['draft'],
    title: 'Compilers',
    active: false,
  });
  return storage;
}
