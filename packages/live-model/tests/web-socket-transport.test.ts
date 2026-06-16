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
});
