import { WebSocketTransport } from '../src/index.js';

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
      key: 'people.1',
      data: { id: 'people.1' },
    });

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'set_value',
        key: 'people.1',
        data: { id: 'people.1' },
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
      key: 'people.1',
      data: { id: 'people.1' },
    });

    expect(senderMessage).not.toHaveBeenCalled();
    expect(receiverMessage).toHaveBeenCalledWith({
      type: 'state',
      key: 'people.1',
      state: {
        kind: 'value',
        value: { id: 'people.1' },
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
          type: 'delete',
          key: 'people.1',
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
});
