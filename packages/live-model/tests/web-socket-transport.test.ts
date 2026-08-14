import { WebSocketQuerySource, WebSocketTransport } from '../src/index.js';

class MockWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.OPEN;
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });
  send = vi.fn();

  constructor(_url: string | URL, _protocols?: string | string[]) {
    super();
    MockWebSocket.instances.push(this);
  }
}

describe('WebSocketTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('keeps the socket open until it has no connections for 5 seconds', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const connection = transport.subscribe('people.1', { message: vi.fn() });

    expect(MockWebSocket.instances).toHaveLength(1);
    connection.unsubscribe();

    vi.advanceTimersByTime(4_999);

    expect(MockWebSocket.instances[0].close).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(MockWebSocket.instances[0].close).toHaveBeenCalledTimes(1);
  });

  test('cancels the pending socket close when a new connection subscribes', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const firstConnection = transport.subscribe('people.1', {
      message: vi.fn(),
    });

    firstConnection.unsubscribe();
    vi.advanceTimersByTime(4_999);

    const secondConnection = transport.subscribe('people.2', {
      message: vi.fn(),
    });

    vi.advanceTimersByTime(1);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].close).not.toHaveBeenCalled();

    secondConnection.unsubscribe();
    vi.advanceTimersByTime(5_000);

    expect(MockWebSocket.instances[0].close).toHaveBeenCalledTimes(1);
  });

  test('sends a subscribe message when a connection subscribes to a key', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    transport.subscribe('people.1', { message: vi.fn() });

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'subscribe',
        key: 'people.1',
      })
    );
  });

  test('only sends one subscribe message for multiple connections to the same key', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    transport.subscribe('people.1', { message: vi.fn() });
    transport.subscribe('people.1', { message: vi.fn() });

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'subscribe',
        key: 'people.1',
      })
    );
  });

  test('sends an unsubscribe message after a key has no connections for 5 seconds', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const connection = transport.subscribe('people.1', { message: vi.fn() });
    connection.unsubscribe();

    vi.advanceTimersByTime(4_999);

    expect(MockWebSocket.instances[0].send).not.toHaveBeenCalledWith(
      JSON.stringify({
        type: 'unsubscribe',
        key: 'people.1',
      })
    );

    vi.advanceTimersByTime(1);

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'unsubscribe',
        key: 'people.1',
      })
    );
  });

  test('cancels a pending unsubscribe without sending another subscribe for the key', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const firstConnection = transport.subscribe('people.1', {
      message: vi.fn(),
    });

    firstConnection.unsubscribe();
    vi.advanceTimersByTime(4_999);

    transport.subscribe('people.1', { message: vi.fn() });

    vi.advanceTimersByTime(1);

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'subscribe',
        key: 'people.1',
      })
    );
    expect(MockWebSocket.instances[0].send).not.toHaveBeenCalledWith(
      JSON.stringify({
        type: 'unsubscribe',
        key: 'people.1',
      })
    );
  });

  test('sends set_value messages to the socket', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });

    const connection = transport.subscribe('people.1', { message: vi.fn() });

    connection.send({
      type: 'set_value',
      data: { id: 'people.1' },
    });

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'op',
        key: 'people.1',
        operation: {
          type: 'set_value',
          data: { id: 'people.1' },
        },
      })
    );
  });

  test('routes state messages to subscribers for the matching key', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });
    const peopleOneMessage = vi.fn();
    const peopleTwoMessage = vi.fn();

    transport.subscribe('people.1', { message: peopleOneMessage });
    transport.subscribe('people.2', { message: peopleTwoMessage });

    const message = {
      type: 'state',
      key: 'people.1',
      state: {
        kind: 'value',
        value: { id: 'people.1' },
        metadata: {},
      },
    };

    MockWebSocket.instances[0].dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(message) })
    );

    expect(peopleOneMessage).toHaveBeenCalledWith(message);
    expect(peopleTwoMessage).not.toHaveBeenCalled();
  });

  test('forwards local set_value messages to other subscribers as state', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });
    const senderMessage = vi.fn();
    const receiverMessage = vi.fn();

    const connection = transport.subscribe('people.1', {
      message: senderMessage,
    });
    transport.subscribe('people.1', { message: receiverMessage });

    connection.send({
      type: 'set_value',
      data: { id: 'people.1' },
    });

    expect(senderMessage).not.toHaveBeenCalled();
    expect(receiverMessage).toHaveBeenCalledWith({
      type: 'state',
      key: 'people.1',
      state: {
        kind: 'value',
        value: { id: 'people.1' },
        metadata: {},
      },
    });
  });

  test('preserves known metadata when forwarding local value operations', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });
    const sender = transport.subscribe('counter', { message: vi.fn() });
    const receiverMessage = vi.fn();
    transport.subscribe('counter', { message: receiverMessage });

    MockWebSocket.instances[0].dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'state',
          key: 'counter',
          state: {
            kind: 'value',
            value: 1,
            metadata: { op_set: { root: 'counter' } },
          },
        }),
      })
    );
    receiverMessage.mockClear();

    sender.send({ type: 'set_value', data: 2 });

    expect(receiverMessage).toHaveBeenCalledWith({
      type: 'state',
      key: 'counter',
      state: {
        kind: 'value',
        value: 2,
        metadata: { op_set: { root: 'counter' } },
      },
    });
  });

  test('forwards local metadata operations without changing the value', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });
    const sender = transport.subscribe('counter', { message: vi.fn() });
    const receiverMessage = vi.fn();
    transport.subscribe('counter', { message: receiverMessage });

    MockWebSocket.instances[0].dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'state',
          key: 'counter',
          state: { kind: 'value', value: 1, metadata: {} },
        }),
      })
    );
    receiverMessage.mockClear();

    sender.send({
      type: 'set_metadata',
      data: { op_set: { root: 'counter' } },
    });

    expect(receiverMessage).toHaveBeenCalledWith({
      type: 'state',
      key: 'counter',
      state: {
        kind: 'value',
        value: 1,
        metadata: { op_set: { root: 'counter' } },
      },
    });
  });

  test('routes inbound action messages as state messages', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });
    const messageHandler = vi.fn();

    transport.subscribe('people.1', { message: messageHandler });

    MockWebSocket.instances[0].dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'op',
          key: 'people.1',
          operation: {
            type: 'delete',
          },
        }),
      })
    );

    expect(messageHandler).toHaveBeenCalledWith({
      type: 'state',
      key: 'people.1',
      state: {
        kind: 'absent',
        reason: 'deleted',
      },
    });
  });

  test('subscribes, routes snapshots, and unsubscribes entity queries', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });
    const message = vi.fn();

    const subscription = transport.query('recent-people', {}, { message });

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'query',
        queryId: 'recent-people',
        data_source: 'entities',
        query: {},
      })
    );

    const snapshot = {
      type: 'query_snapshot',
      queryId: 'recent-people',
      items: [
        {
          key: 'people.1',
          state: {
            kind: 'value',
            value: { name: 'Ada' },
            metadata: {},
          },
        },
      ],
      range: { hasMore: false },
    };
    MockWebSocket.instances[0].dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(snapshot) })
    );

    expect(message).toHaveBeenCalledWith(snapshot);

    subscription.unsubscribe();

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'unquery',
        queryId: 'recent-people',
      })
    );
  });

  test('adapts remote queries to the shared QuerySource interface', () => {
    const transport = new WebSocketTransport('ws://live-model.test', {
      WebSocket: MockWebSocket as unknown as typeof WebSocket,
    });
    const source = new WebSocketQuerySource(transport);
    const next = vi.fn();

    source.query({}, { next });

    const sentQuery = JSON.parse(
      MockWebSocket.instances[0].send.mock.calls[0][0]
    );
    expect(sentQuery).toMatchObject({
      type: 'query',
      data_source: 'entities',
      query: {},
    });

    const snapshot = {
      type: 'query_snapshot',
      queryId: sentQuery.queryId,
      items: [
        {
          key: 'people.1',
          state: { kind: 'value', value: { name: 'Ada' }, metadata: {} },
        },
      ],
      range: { hasMore: false },
    };
    MockWebSocket.instances[0].dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(snapshot) })
    );

    expect(next).toHaveBeenCalledWith({
      items: snapshot.items,
      range: snapshot.range,
    });
  });
});
