import { liveReference, type ProtocolMessage } from 'live-model';
import type { Message as WebSocketMessage, Peer } from 'crossws';
import { BackendLiveModel } from 'live-model';
import type { QuerySource, StorageAdapter } from 'live-model';
import { createLiveModelWebSocket } from '../src/websocket-handler.js';

class TestPeer {
  readonly sent: unknown[] = [];

  constructor(readonly name: string) {}

  send(message: string) {
    this.sent.push(JSON.parse(message));
  }

  toString() {
    return this.name;
  }
}

function asPeer(peer: TestPeer): Peer {
  return peer as unknown as Peer;
}

function createMessage(message: ProtocolMessage) {
  return {
    text: () => JSON.stringify(message),
  } as WebSocketMessage;
}

function createStorage(
  initialValues: Record<string, unknown> = {}
): StorageAdapter {
  const values = new Map(Object.entries(initialValues));
  const metadata = new Map<string, object>();

  return {
    get(key) {
      if (!values.has(key)) {
        return { kind: 'absent', reason: 'not_found' };
      }

      return {
        kind: 'value',
        value: values.get(key),
        metadata: metadata.get(key) ?? {},
      };
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

describe('createLiveModelWebSocket', () => {
  const logger = {
    error: vi.fn(),
    log: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('sends a state snapshot for every subscribe from the same peer', () => {
    const websocket = createLiveModelWebSocket(
      new BackendLiveModel(createStorage({ foo: { id: 'foo' } })),
      logger
    );
    const peer = new TestPeer('peer');

    websocket.message?.(
      asPeer(peer),
      createMessage({
        type: 'subscribe',
        key: 'foo',
      })
    );
    websocket.message?.(
      asPeer(peer),
      createMessage({
        type: 'subscribe',
        key: 'foo',
      })
    );

    expect(peer.sent).toEqual([
      {
        type: 'state',
        key: 'foo',
        state: {
          kind: 'value',
          value: { id: 'foo' },
          metadata: {},
        },
      },
      {
        type: 'state',
        key: 'foo',
        state: {
          kind: 'value',
          value: { id: 'foo' },
          metadata: {},
        },
      },
    ]);
  });

  test('does not duplicate forwarded updates after duplicate subscribes from the same peer', () => {
    const websocket = createLiveModelWebSocket(
      new BackendLiveModel(createStorage()),
      logger
    );
    const subscriber = new TestPeer('subscriber');
    const sender = new TestPeer('sender');

    websocket.message?.(
      asPeer(subscriber),
      createMessage({
        type: 'subscribe',
        key: 'foo',
      })
    );
    websocket.message?.(
      asPeer(subscriber),
      createMessage({
        type: 'subscribe',
        key: 'foo',
      })
    );
    websocket.message?.(
      asPeer(sender),
      createMessage({
        type: 'op',
        key: 'foo',
        operation: {
          type: 'set_value',
          data: { id: 'foo' },
        },
      })
    );

    expect(subscriber.sent).toEqual([
      {
        type: 'state',
        key: 'foo',
        state: {
          kind: 'absent',
          reason: 'not_found',
        },
      },
      {
        type: 'state',
        key: 'foo',
        state: {
          kind: 'absent',
          reason: 'not_found',
        },
      },
      {
        type: 'state',
        key: 'foo',
        state: {
          kind: 'value',
          value: { id: 'foo' },
          metadata: {},
        },
      },
    ]);
  });

  test('only forwards updates to peers subscribed to the matching key', () => {
    const websocket = createLiveModelWebSocket(
      new BackendLiveModel(createStorage()),
      logger
    );
    const fooSubscriber = new TestPeer('fooSubscriber');
    const barSubscriber = new TestPeer('barSubscriber');
    const sender = new TestPeer('sender');

    websocket.message?.(
      asPeer(fooSubscriber),
      createMessage({
        type: 'subscribe',
        key: 'foo',
      })
    );
    websocket.message?.(
      asPeer(barSubscriber),
      createMessage({
        type: 'subscribe',
        key: 'bar',
      })
    );
    websocket.message?.(
      asPeer(sender),
      createMessage({
        type: 'op',
        key: 'foo',
        operation: {
          type: 'set_value',
          data: { id: 'foo' },
        },
      })
    );

    expect(fooSubscriber.sent).toHaveLength(2);
    expect(fooSubscriber.sent[1]).toEqual({
      type: 'state',
      key: 'foo',
      state: {
        kind: 'value',
        value: { id: 'foo' },
        metadata: {},
      },
    });
    expect(barSubscriber.sent).toEqual([
      {
        type: 'state',
        key: 'bar',
        state: {
          kind: 'absent',
          reason: 'not_found',
        },
      },
    ]);
  });

  test('forwards mutations made directly through a backend Live', () => {
    const liveModel = new BackendLiveModel(createStorage());
    const websocket = createLiveModelWebSocket(liveModel, logger);
    const subscriber = new TestPeer('subscriber');

    websocket.message?.(
      asPeer(subscriber),
      createMessage({ type: 'subscribe', key: 'foo' })
    );
    liveModel.forKey('foo').setValue({ id: 'from-backend' });

    expect(subscriber.sent[1]).toEqual({
      type: 'state',
      key: 'foo',
      state: {
        kind: 'value',
        value: { id: 'from-backend' },
        metadata: {},
      },
    });
  });

  test('forwards metadata updates in the shared Live state', () => {
    const liveModel = new BackendLiveModel(createStorage({ counter: 1 }));
    const websocket = createLiveModelWebSocket(liveModel, logger);
    const updater = new TestPeer('updater');
    const subscriber = new TestPeer('subscriber');

    websocket.message?.(
      asPeer(updater),
      createMessage({ type: 'subscribe', key: 'counter' })
    );
    websocket.message?.(
      asPeer(subscriber),
      createMessage({ type: 'subscribe', key: 'counter' })
    );
    websocket.message?.(
      asPeer(updater),
      createMessage({
        type: 'op',
        key: 'counter',
        operation: {
          type: 'set_metadata',
          data: { op_set: { root: 'counter' } },
        },
      })
    );

    expect(subscriber.sent[subscriber.sent.length - 1]).toEqual({
      type: 'state',
      key: 'counter',
      state: {
        kind: 'value',
        value: 1,
        metadata: { op_set: { root: 'counter' } },
      },
    });
    expect(liveModel.forKey('counter').get()).toEqual({
      kind: 'value',
      value: 1,
      metadata: { op_set: { root: 'counter' } },
    });
  });

  test('sends resolved backend Lives as wire references', () => {
    const liveModel = new BackendLiveModel(createStorage());
    const author = liveModel.forKey('people.ada');
    liveModel.forKey('posts.first').setValue({ author });
    const websocket = createLiveModelWebSocket(liveModel, logger);
    const subscriber = new TestPeer('subscriber');

    websocket.message?.(
      asPeer(subscriber),
      createMessage({ type: 'subscribe', key: 'posts.first' })
    );

    expect(subscriber.sent).toEqual([
      {
        type: 'state',
        key: 'posts.first',
        state: {
          kind: 'value',
          value: { author: liveReference('people.ada') },
          metadata: {},
        },
      },
    ]);
  });

  test('encodes references only within Live state values', () => {
    const value = { id: 'foo' };
    const liveModel = new BackendLiveModel(createStorage({ foo: value }));
    const encodeReferences = vi.spyOn(liveModel, 'encodeReferences');
    const websocket = createLiveModelWebSocket(liveModel, logger);
    const subscriber = new TestPeer('subscriber');

    websocket.message?.(
      asPeer(subscriber),
      createMessage({ type: 'subscribe', key: 'foo' })
    );

    expect(encodeReferences).toHaveBeenCalledOnce();
    expect(encodeReferences).toHaveBeenCalledWith(value);
  });

  test('subscribes to entity query snapshots until unquery', () => {
    const liveModel = new BackendLiveModel(
      createStorage({ foo: { id: 'foo', count: 1 } })
    );
    const websocket = createLiveModelWebSocket(liveModel, logger);
    const peer = new TestPeer('peer');

    websocket.message?.(
      asPeer(peer),
      createMessage({
        type: 'query',
        queryId: 'recent-tasks',
        data_source: 'entities',
        query: {},
      })
    );

    expect(peer.sent).toEqual([
      {
        type: 'query_snapshot',
        queryId: 'recent-tasks',
        items: [
          {
            key: 'foo',
            state: {
              kind: 'value',
              value: { id: 'foo', count: 1 },
              metadata: {},
            },
          },
        ],
        range: { hasMore: false },
      },
    ]);

    liveModel.forKey('foo').setValue({ id: 'foo', count: 2 });
    expect(peer.sent.at(-1)).toMatchObject({
      type: 'query_snapshot',
      items: [
        {
          key: 'foo',
          state: {
            kind: 'value',
            value: { id: 'foo', count: 2 },
            metadata: {},
          },
        },
      ],
    });

    liveModel.forKey('bar').setValue({ id: 'bar' });
    expect(
      (peer.sent.at(-1) as { items: Array<{ key: string }> }).items.map(
        (item) => item.key
      )
    ).toEqual(['bar', 'foo']);

    liveModel.forKey('foo').deleteValue();
    expect(
      (peer.sent.at(-1) as { items: Array<{ key: string }> }).items.map(
        (item) => item.key
      )
    ).toEqual(['bar']);

    websocket.message?.(
      asPeer(peer),
      createMessage({
        type: 'unquery',
        queryId: 'recent-tasks',
      })
    );
    const messageCount = peer.sent.length;

    liveModel.forKey('foo').setValue({ id: 'foo', count: 3 });
    expect(peer.sent).toHaveLength(messageCount);
  });

  test('delegates query execution to the configured source', () => {
    const unsubscribe = vi.fn();
    const query = vi.fn<QuerySource['query']>((query, subscriber) => {
      subscriber.next({
        items: [
          {
            key: 'external.1',
            state: {
              kind: 'value',
              value: { source: 'external' } as never,
              metadata: {},
            },
          },
        ],
        range: { hasMore: false },
      });
      return { unsubscribe };
    });
    const websocket = createLiveModelWebSocket(
      new BackendLiveModel(createStorage()),
      logger,
      { query }
    );
    const peer = new TestPeer('peer');

    websocket.message?.(
      asPeer(peer),
      createMessage({
        type: 'query',
        queryId: 'external',
        data_source: 'entities',
        query: { implementation: 'specific' },
      })
    );

    expect(query).toHaveBeenCalledWith(
      { implementation: 'specific' },
      expect.objectContaining({ next: expect.any(Function) })
    );
    expect(peer.sent).toEqual([
      {
        type: 'query_snapshot',
        queryId: 'external',
        items: [
          {
            key: 'external.1',
            state: {
              kind: 'value',
              value: { source: 'external' },
              metadata: {},
            },
          },
        ],
        range: { hasMore: false },
      },
    ]);

    websocket.message?.(
      asPeer(peer),
      createMessage({ type: 'unquery', queryId: 'external' })
    );
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
