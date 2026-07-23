import type { AnyOperation, StateMessage } from '@live-model/protocol';
import { act } from '@testing-library/react';
import {
  configureLiveModel,
  WebSocketTransport,
  type WebSocketTransportConnection,
  type WebSocketTransportSubscriber,
} from '../../src/index.js';

type WriteMessage = AnyOperation;

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
        this.applyMessage(key, message);
        this.broadcast(this.operationToState(key, message), connection);
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

    this.values.delete(key);
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
  ): StateMessage {
    if (message.type === 'set_value') {
      return {
        type: 'state',
        key,
        state: {
          kind: 'value',
          value: message.data,
        },
      };
    }

    return {
      type: 'state',
      key,
      state: {
        kind: 'absent',
        reason: 'deleted',
      },
    };
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
