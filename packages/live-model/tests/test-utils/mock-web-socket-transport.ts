import type { Operation, StateMessage } from '../../src/protocol.js';
import { act } from '@testing-library/react';
import {
  configureLiveModel,
  WebSocketTransport,
  type WebSocketTransportConnection,
  type WebSocketTransportSubscriber,
} from '../../src/index.js';

type WriteMessage = Operation;

type Connection = WebSocketTransportConnection & {
  key: string;
  subscriber: WebSocketTransportSubscriber;
};

class MockWebSocketTransport extends WebSocketTransport {
  private values = new Map<string, unknown>();
  private metadata = new Map<string, object>();
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
        this.applyMessage(key, message);
        const state = this.operationToState(key, message);
        if (state) {
          this.broadcast(state, connection);
        }
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
      if (!connections.has(connection)) {
        return;
      }

      act(() => {
        const state: StateMessage['state'] = this.values.has(key)
          ? {
              kind: 'value',
              value: this.values.get(key),
              metadata: this.metadata.get(key) ?? {},
            }
          : {
              kind: 'absent',
              reason: 'not_found',
            };

        subscriber.message({
          type: 'state',
          key,
          state,
        });
      });
    });

    return connection;
  }

  private applyMessage(key: string, message: WriteMessage) {
    if (message.type === 'set_value') {
      this.values.set(key, message.data);
      return;
    }

    if (message.type === 'delete') {
      this.values.delete(key);
      return;
    }

    if (message.type === 'set_metadata') {
      this.metadata.set(key, message.data as object);
    }
  }

  private broadcast(message: StateMessage, sender: Connection) {
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

  override operationToState(
    key: string,
    message: WriteMessage
  ): StateMessage | undefined {
    if (message.type === 'set_value') {
      return {
        type: 'state',
        key,
        state: {
          kind: 'value',
          value: message.data,
          metadata: this.metadata.get(key) ?? {},
        },
      };
    }

    if (message.type === 'delete') {
      return {
        type: 'state',
        key,
        state: {
          kind: 'absent',
          reason: 'deleted',
        },
      };
    }

    return undefined;
  }
}

export function mockWebSocketData(data: Record<string, unknown>) {
  configureLiveModel({
    transport: new MockWebSocketTransport(data),
  });
}

export function clearWebSocketData() {
  configureLiveModel({});
}
