import type {
  DeleteMessage,
  SnapshotMessage,
} from '@live-model/protocol';
import { act } from '@testing-library/react';
import {
  WebSocketLive,
  WebSocketTransport,
  type WebSocketTransportConnection,
  type WebSocketTransportSubscriber,
} from '../../src/index.js';

type Message = SnapshotMessage | DeleteMessage;

type Connection = WebSocketTransportConnection & {
  key: string;
  subscriber: WebSocketTransportSubscriber;
};

class MockWebSocketTransport extends WebSocketTransport {
  private values = new Map<string, unknown>();
  private connectionsByKey = new Map<string, Set<Connection>>();

  constructor(initialValues: Record<string, unknown>) {
    super('ws://live-model.test');

    for (const [key, value] of Object.entries(initialValues)) {
      this.values.set(key, value);
    }
  }

  override subscribe(
    key: string,
    subscriber: WebSocketTransportSubscriber
  ): WebSocketTransportConnection {
    let connections = this.connectionsByKey.get(key);

    if (!connections) {
      connections = new Set();
      this.connectionsByKey.set(key, connections);
    }

    const connection: Connection = {
      key,
      subscriber,
      send: (message) => {
        this.applyMessage(message);
        this.broadcast(message, connection);
      },
      unsubscribe: () => {
        connections.delete(connection);

        if (connections.size === 0) {
          this.connectionsByKey.delete(key);
        }
      },
    };

    connections.add(connection);
    queueMicrotask(() => {
      if (!connections.has(connection) || !this.values.has(key)) {
        return;
      }

      act(() => {
        subscriber.message({
          type: 'snapshot',
          key,
          data: this.values.get(key),
        });
      });
    });

    return connection;
  }

  private applyMessage(message: Message) {
    if (message.type === 'snapshot') {
      this.values.set(message.key, message.data);
      return;
    }

    this.values.delete(message.key);
  }

  private broadcast(message: Message, sender: Connection) {
    const connections = this.connectionsByKey.get(message.key);

    if (!connections) {
      return;
    }

    for (const connection of connections) {
      if (connection === sender) {
        continue;
      }

      queueMicrotask(() => {
        if (connections.has(connection)) {
          act(() => {
            connection.subscriber.message(message);
          });
        }
      });
    }
  }
}

let originalTransport: WebSocketTransport | undefined;

export function mockWebSocketData(data: Record<string, unknown>) {
  originalTransport ??= WebSocketLive.defaultTransport;
  WebSocketLive.defaultTransport = new MockWebSocketTransport(data);
}

export function clearWebSocketData() {
  if (originalTransport) {
    WebSocketLive.defaultTransport = originalTransport;
    originalTransport = undefined;
  }
}
