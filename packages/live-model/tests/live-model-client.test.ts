import {
  buildType,
  liveReference,
  LiveModelClient,
  OperationSetRegistry,
  WebSocketTransport,
  type Live,
  type Operation,
  type StateMessage,
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
});
