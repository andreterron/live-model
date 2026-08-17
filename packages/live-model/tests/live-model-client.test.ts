import { z } from 'zod';
import {
  buildType,
  liveReference,
  LiveModelClient,
  OperationSetRegistry,
  WebSocketTransport,
  type Live,
  type LiveQuery,
  type Operation,
  type QuerySnapshotMessage,
  type StateMessage,
  type Subscription,
  type WebSocketQuerySubscriber,
  type WebSocketTransportConnection,
  type WebSocketTransportSubscriber,
} from '../src/index.js';

class ReferenceTestTransport extends WebSocketTransport {
  readonly operations: Array<{ key: string; operation: Operation }> = [];
  readonly subscribedKeys: string[] = [];
  private readonly subscribers = new Map<
    string,
    WebSocketTransportSubscriber
  >();
  readonly queries: Array<{
    queryId: string;
    query: LiveQuery<unknown>;
  }> = [];
  private querySubscriber?: WebSocketQuerySubscriber;

  constructor() {
    super('ws://live-model.test');
  }

  override subscribe(
    key: string,
    subscriber: WebSocketTransportSubscriber
  ): WebSocketTransportConnection {
    this.subscribedKeys.push(key);
    this.subscribers.set(key, subscriber);

    return {
      send: (operation) => this.operations.push({ key, operation }),
      unsubscribe: () => this.subscribers.delete(key),
    };
  }

  emit(key: string, state: StateMessage['state']) {
    this.subscribers.get(key)?.message({
      type: 'state',
      key,
      state,
    });
  }

  override query(
    queryId: string,
    query: LiveQuery<unknown>,
    subscriber: WebSocketQuerySubscriber
  ): Subscription {
    this.queries.push({ queryId, query });
    this.querySubscriber = subscriber;
    return {
      unsubscribe: () => {
        this.querySubscriber = undefined;
      },
    };
  }

  emitQuery(message: QuerySnapshotMessage) {
    this.querySubscriber?.message(message);
  }
}

describe('LiveModelClient', () => {
  test('exposes an injectable operation-set registry', () => {
    const operationSetRegistry = new OperationSetRegistry();
    const client = new LiveModelClient({ operationSetRegistry });

    expect(client.operationSetRegistry).toBe(operationSetRegistry);
    client.operationSetRegistry.register(buildType('counter'));
    expect(operationSetRegistry.has('counter')).toBe(true);
  });

  test('returns the same live for the same key', () => {
    const client = new LiveModelClient({
      transport: new WebSocketTransport('ws://live-model.test'),
    });

    expect(client.forKey('people.1')).toBe(client.forKey('people.1'));
  });

  test('returns different lives for different keys', () => {
    const client = new LiveModelClient({
      transport: new WebSocketTransport('ws://live-model.test'),
    });

    expect(client.forKey('people.1')).not.toBe(client.forKey('people.2'));
  });

  test('returns a query-result Live and forwards the query specification', () => {
    const transport = new ReferenceTestTransport();
    const client = new LiveModelClient({ transport });
    const resultLive = client.query<{ name: string }>({
      filter: { name: { $startsWith: 'A' } },
      limit: 5,
    });
    const states: unknown[] = [];

    resultLive.subscribe({ next: (state) => states.push(state) });
    const sent = transport.queries[0];
    expect(sent).toMatchObject({
      query: {
        filter: { name: { $startsWith: 'A' } },
        limit: 5,
      },
    });

    transport.emitQuery({
      type: 'query_snapshot',
      queryId: sent.queryId,
      items: [
        {
          key: 'people.ada',
          state: {
            kind: 'value',
            value: { name: 'Ada' },
            metadata: {},
          },
        },
      ],
      range: { hasMore: false },
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
                value: { name: 'Ada' },
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

  test('keeps different clients isolated', () => {
    const firstClient = new LiveModelClient({
      transport: new WebSocketTransport('ws://live-model.test'),
    });
    const secondClient = new LiveModelClient({
      transport: new WebSocketTransport('ws://live-model.test'),
    });

    expect(firstClient.forKey('people.1')).not.toBe(
      secondClient.forKey('people.1')
    );
  });

  test('requires websocket configuration before creating lives', () => {
    const client = new LiveModelClient();

    expect(() => client.forKey('people.1')).toThrow(
      'LiveModelClient requires a websocketUrl or transport'
    );
  });

  test('resolves remote references without subscribing to their targets', () => {
    const transport = new ReferenceTestTransport();
    const client = new LiveModelClient({ transport });
    const post = client.forKey<{
      author: Live<{ name: string }>;
      reviewers: Array<Live<{ name: string }>>;
    }>('posts.first');
    post.subscribe({ next: vi.fn() });

    transport.emit('posts.first', {
      kind: 'value',
      metadata: {},
      value: {
        author: liveReference('people.ada'),
        reviewers: [liveReference('people.ada')],
      },
    });

    const state = post.get();
    expect(state.kind).toBe('value');
    if (state.kind !== 'value') {
      return;
    }

    expect(state.value.author).toBe(client.forKey('people.ada'));
    expect(state.value.reviewers[0]).toBe(state.value.author);
    expect(transport.subscribedKeys).toEqual(['posts.first']);

    state.value.author.subscribe({ next: vi.fn() });
    expect(transport.subscribedKeys).toEqual(['posts.first', 'people.ada']);
  });

  test('encodes resolved Lives when a consumer writes a value back', () => {
    const transport = new ReferenceTestTransport();
    const client = new LiveModelClient({ transport });
    const post = client.forKey<{
      title: string;
      author: Live<{ name: string }>;
    }>('posts.first');
    post.subscribe({ next: vi.fn() });
    transport.emit('posts.first', {
      kind: 'value',
      metadata: {},
      value: {
        title: 'Draft',
        author: liveReference('people.ada'),
      },
    });

    const state = post.get();
    expect(state.kind).toBe('value');
    if (state.kind !== 'value') {
      return;
    }

    post.setValue({ ...state.value, title: 'Published' });

    expect(transport.operations[transport.operations.length - 1]).toEqual({
      key: 'posts.first',
      operation: {
        type: 'set_value',
        data: {
          title: 'Published',
          author: liveReference('people.ada'),
        },
      },
    });
    expect(post.get()).toEqual({
      kind: 'value',
      metadata: {},
      value: {
        title: 'Published',
        author: client.forKey('people.ada'),
      },
    });
  });

  test('sends metadata operations without changing the value', () => {
    const transport = new ReferenceTestTransport();
    const client = new LiveModelClient({ transport });
    const live = client.forKey<number>('counter');
    live.subscribe({ next: vi.fn() });
    transport.emit('counter', {
      kind: 'value',
      value: 1,
      metadata: {},
    });

    live.setMetadata({ op_set: { root: 'counter' } });

    expect(transport.operations[transport.operations.length - 1]).toEqual({
      key: 'counter',
      operation: {
        type: 'set_metadata',
        data: { op_set: { root: 'counter' } },
      },
    });
    expect(live.get()).toEqual({
      kind: 'value',
      value: 1,
      metadata: { op_set: { root: 'counter' } },
    });
  });

  test('processes and sends operations from the assigned client operation set', () => {
    const transport = new ReferenceTestTransport();
    const client = new LiveModelClient({ transport });
    client.operationSetRegistry.register(
      buildType('counter').operation(
        'increment',
        z.number(),
        (state: number, amount) => state + amount
      )
    );
    const live = client.forKey<number>('counter');
    live.subscribe({ next: vi.fn() });
    transport.emit('counter', {
      kind: 'value',
      value: 1,
      metadata: { op_set: { root: 'counter' } },
    });

    expect(live.op({ type: 'increment', data: 2 })).toEqual({
      status: 'success',
    });
    expect(transport.operations.at(-1)).toEqual({
      key: 'counter',
      operation: { type: 'increment', data: 2 },
    });
    expect(live.get()).toEqual({
      kind: 'value',
      value: 3,
      metadata: { op_set: { root: 'counter' } },
    });
  });
});
