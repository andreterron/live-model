import { z } from 'zod';
import { allKeysKey, liveReference } from '../src/protocol.js';
import {
  BackendLiveModel,
  buildType,
  type Live,
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
      { kind: 'value', value: { count: 1 }, metadata: {} },
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
      { kind: 'value', value: [], metadata: {} },
      { kind: 'value', value: ['foo'], metadata: {} },
      { kind: 'value', value: [], metadata: {} },
    ]);
  });

  test('rejects operations on the reserved all-keys Live', () => {
    const liveModel = new BackendLiveModel(createStorage());

    expect(
      liveModel.processOperation(allKeysKey, { type: 'delete' })
    ).toMatchObject({ status: 'error' });
  });

  test('defaults and caps query limits before storage execution', () => {
    const storage = createStorage();
    const queryKeys = vi.fn(() => ({ keys: [], hasMore: false }));
    storage.queryKeys = queryKeys;
    const liveModel = new BackendLiveModel(storage);

    liveModel.query({ filter: {} }).subscribe({ next: vi.fn() });
    expect(queryKeys).toHaveBeenLastCalledWith({ filter: {}, limit: 100 });

    liveModel.query({ filter: {}, limit: 20_000 }).subscribe({ next: vi.fn() });
    expect(queryKeys).toHaveBeenLastCalledWith({ filter: {}, limit: 10_000 });
  });

  test('resolves stored references to canonical lazy Lives', () => {
    const storage = createStorage();
    storage.set('people.ada', { name: 'Ada' });
    storage.set('posts.first', {
      author: liveReference('people.ada'),
      reviewers: [liveReference('people.ada')],
    });
    const liveModel = new BackendLiveModel(storage);
    const author = liveModel.forKey<{ name: string }>('people.ada');
    const postState = liveModel
      .forKey<{
        author: Live<{ name: string }>;
        reviewers: Array<Live<{ name: string }>>;
      }>('posts.first')
      .get();

    expect(postState.kind).toBe('value');
    if (postState.kind !== 'value') {
      return;
    }

    expect(postState.value.author).toBe(author);
    expect(postState.value.reviewers[0]).toBe(author);
    expect(author.get()).toEqual({
      kind: 'value',
      value: { name: 'Ada' },
      metadata: {},
    });
  });

  test('encodes canonical Lives before persistence and notifications', () => {
    const storage = createStorage();
    const liveModel = new BackendLiveModel(storage);
    const author = liveModel.forKey<{ name: string }>('people.ada');
    const post = liveModel.forKey<{
      title: string;
      author: Live<{ name: string }>;
    }>('posts.first');
    const states: unknown[] = [];
    post.subscribe({ next: (state) => states.push(state) });

    post.setValue({ title: 'Notes', author });

    expect(storage.get('posts.first')).toEqual({
      kind: 'value',
      metadata: {},
      value: {
        title: 'Notes',
        author: liveReference('people.ada'),
      },
    });
    expect(states[states.length - 1]).toEqual({
      kind: 'value',
      value: { title: 'Notes', author },
      metadata: {},
    });
  });

  test('rejects Lives from another registry in operation data', () => {
    const first = new BackendLiveModel(createStorage());
    const second = new BackendLiveModel(createStorage());

    expect(
      first.forKey('container').op('set_value', {
        target: second.forKey('target'),
      })
    ).toMatchObject({
      status: 'error',
      error: { code: 'invalid_reference' },
    });
  });

  test('encodes references in custom operation data', () => {
    const storage = createStorage();
    storage.set('posts.first', {});
    storage.setMetadata('posts.first', { op_set: { root: 'attachment' } });
    const liveModel = new BackendLiveModel(storage);
    liveModel.operationSetRegistry.register(
      buildType('attachment').operation(
        'attach',
        z.unknown(),
        (_state: unknown, value) => value
      )
    );
    const target = liveModel.forKey('people.ada');

    expect(
      liveModel.forKey('posts.first').op({
        type: 'attach',
        data: { author: target },
      })
    ).toEqual({ status: 'success' });
    expect(storage.get('posts.first')).toEqual({
      kind: 'value',
      value: { author: liveReference('people.ada') },
      metadata: { op_set: { root: 'attachment' } },
    });
  });

  test('dispatches operations from the persisted operation-set metadata', () => {
    const storage = createStorage();
    storage.set('counter', 1);
    storage.setMetadata('counter', { op_set: { root: 'counter' } });
    const counter = buildType('counter').operation(
      'increment',
      z.number(),
      (state: number, amount) => state + amount
    );
    const liveModel = new BackendLiveModel(storage);
    liveModel.operationSetRegistry.register(counter);

    expect(
      liveModel.processOperation('counter', {
        type: 'increment',
        data: 2,
      })
    ).toEqual({ type: 'op_status', status: 'success' });
    expect(storage.get('counter')).toEqual({
      kind: 'value',
      value: 3,
      metadata: { op_set: { root: 'counter' } },
    });
  });

  test('persists and publishes effects targeting another key', () => {
    const storage = createStorage();
    storage.set('todos', {});
    storage.setMetadata('todos', { op_set: { root: 'collection' } });
    const collection = buildType('collection').operation(
      'insert',
      z.object({ id: z.string(), value: z.unknown() })
    );
    const liveModel = new BackendLiveModel(storage);
    liveModel.operationSetRegistry.register(collection, {
      insert: (_state, operation, context) => ({
        effects: [
          {
            type: 'set',
            key: `${context.key}/${operation.data.id}`,
            value: operation.data.value,
          },
        ],
      }),
    });
    const childStates: unknown[] = [];
    liveModel.forKey('todos/first').subscribe({
      next: (state) => childStates.push(state),
    });

    expect(
      liveModel.processOperation('todos', {
        type: 'insert',
        data: { id: 'first', value: { title: 'Write tests' } },
      })
    ).toEqual({ type: 'op_status', status: 'success' });
    expect(storage.get('todos/first')).toEqual({
      kind: 'value',
      value: { title: 'Write tests' },
      metadata: {},
    });
    expect(childStates).toEqual([
      { kind: 'absent', reason: 'not_found' },
      {
        kind: 'value',
        value: { title: 'Write tests' },
        metadata: {},
      },
    ]);
  });
});
