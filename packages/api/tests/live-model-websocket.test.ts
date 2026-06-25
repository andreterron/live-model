import { allKeysKey, type Message } from '@live-model/protocol';
import type { Message as WebSocketMessage, Peer } from 'crossws';
import {
  createLiveModelWebSocket,
  type LiveModelWebSocketStore,
} from '../src/live-model-websocket.js';

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

function createMessage(message: Message) {
  return {
    text: () => JSON.stringify(message),
  } as WebSocketMessage;
}

function createStore(
  initialValues: Record<string, unknown> = {}
): LiveModelWebSocketStore {
  const values = new Map(Object.entries(initialValues));

  return {
    getLiveState(key) {
      if (key === allKeysKey) {
        return {
          kind: 'value',
          value: [...values.keys()].sort(),
        };
      }

      if (!values.has(key)) {
        return { kind: 'absent', reason: 'not_found' };
      }

      return {
        kind: 'value',
        value: values.get(key),
      };
    },
    persistMessage(message) {
      if (message.key === allKeysKey) {
        return false;
      }

      if (message.type === 'delete') {
        values.delete(message.key);
        return true;
      }

      if (message.type !== 'set_value') {
        return false;
      }

      values.set(message.key, message.data);
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
      createStore({ foo: { id: 'foo' } }),
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
        },
      },
      {
        type: 'state',
        key: 'foo',
        state: {
          kind: 'value',
          value: { id: 'foo' },
        },
      },
    ]);
  });

  test('does not duplicate forwarded updates after duplicate subscribes from the same peer', () => {
    const websocket = createLiveModelWebSocket(createStore(), logger);
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
        type: 'set_value',
        key: 'foo',
        data: { id: 'foo' },
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
        },
      },
    ]);
  });

  test('only forwards updates to peers subscribed to the matching key', () => {
    const websocket = createLiveModelWebSocket(createStore(), logger);
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
        type: 'set_value',
        key: 'foo',
        data: { id: 'foo' },
      })
    );

    expect(fooSubscriber.sent).toHaveLength(2);
    expect(fooSubscriber.sent[1]).toEqual({
      type: 'state',
      key: 'foo',
      state: {
        kind: 'value',
        value: { id: 'foo' },
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
});
