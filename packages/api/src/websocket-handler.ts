import {
  type LiveState,
  type OperationStatusMessage,
  type ProtocolMessage,
  type QuerySnapshotMessage,
  type StateMessage,
  protocolMessageSchema,
} from '@live-model/protocol';
import type { Message as WebSocketMessage, Peer, WSOptions } from 'crossws';
import {
  EntitiesQuerySource,
  type BackendLiveModel,
  type QuerySource,
  type Subscription,
} from 'live-model';

// TODO: Remove/Replace this type
export interface LiveModelWebSocketLogger {
  error(...args: unknown[]): void;
  log(...args: unknown[]): void;
}

function parseProtocolMessage(text: string): ProtocolMessage | undefined {
  const parsed: unknown = JSON.parse(text);
  const result = protocolMessageSchema.safeParse(parsed);

  return result.success ? (result.data as ProtocolMessage) : undefined;
}

function sendError(peer: Peer, error: string) {
  peer.send(JSON.stringify({ error }));
}

export function createLiveModelWebSocket(
  liveModel: BackendLiveModel,
  logger: LiveModelWebSocketLogger = console,
  entityQuerySource: QuerySource = new EntitiesQuerySource(liveModel)
): WSOptions {
  const peerSubscriptions = new Map<Peer, Map<string, Subscription>>();
  const peerQueries = new Map<Peer, Map<string, Subscription>>();
  // TODO: Remove/refactor this synchronous suppression mechanism. Operations
  // should carry origin and operation IDs, and resulting state messages should
  // reference the operation so transports or clients can reconcile safely.
  let suppressedNotification: { peer: Peer; key: string } | undefined;

  function encodeState(state: LiveState<unknown>): LiveState<unknown> {
    if (state.kind !== 'value') {
      return state;
    }

    return {
      ...state,
      value: liveModel.encodeReferences(state.value),
    };
  }

  function send(peer: Peer, message: StateMessage | QuerySnapshotMessage) {
    const encodedMessage =
      message.type === 'state'
        ? { ...message, state: encodeState(message.state) }
        : {
            ...message,
            items: message.items.map((item) => ({
              ...item,
              state: encodeState(item.state),
            })),
          };

    peer.send(JSON.stringify(encodedMessage));
  }

  function sendState(peer: Peer, key: string) {
    send(peer, { type: 'state', key, state: liveModel.forKey(key).get() });
  }

  function subscribePeer(peer: Peer, key: string) {
    let subscriptions = peerSubscriptions.get(peer);

    if (!subscriptions) {
      subscriptions = new Map();
      peerSubscriptions.set(peer, subscriptions);
    }

    if (subscriptions.has(key)) {
      sendState(peer, key);
      return;
    }

    const subscription = liveModel.forKey(key).subscribe({
      next(state) {
        if (
          suppressedNotification?.peer === peer &&
          suppressedNotification.key === key
        ) {
          return;
        }

        send(peer, { type: 'state', key, state });
      },
    });
    subscriptions.set(key, subscription);
  }

  function unsubscribePeer(peer: Peer, key: string) {
    const subscriptions = peerSubscriptions.get(peer);
    subscriptions?.get(key)?.unsubscribe();
    subscriptions?.delete(key);

    if (subscriptions?.size === 0) {
      peerSubscriptions.delete(peer);
    }
  }

  function unsubscribePeerFromAllKeys(peer: Peer) {
    const subscriptions = peerSubscriptions.get(peer);

    if (!subscriptions) {
      return;
    }

    for (const subscription of subscriptions.values()) {
      subscription.unsubscribe();
    }

    peerSubscriptions.delete(peer);
  }

  function unsubscribePeerFromQuery(peer: Peer, queryId: string) {
    const queries = peerQueries.get(peer);
    queries?.get(queryId)?.unsubscribe();
    queries?.delete(queryId);

    if (queries?.size === 0) {
      peerQueries.delete(peer);
    }
  }

  function subscribePeerToQuery(peer: Peer, queryId: string, query: unknown) {
    unsubscribePeerFromQuery(peer, queryId);

    let querySubscription: Subscription;
    try {
      querySubscription = entityQuerySource.query(query, {
        next(result) {
          const message: QuerySnapshotMessage = {
            type: 'query_snapshot',
            queryId,
            ...result,
          };
          send(peer, message);
        },
        error(error) {
          sendError(
            peer,
            error instanceof Error ? error.message : 'Query source failed'
          );
        },
      });
    } catch (error) {
      sendError(
        peer,
        error instanceof Error ? error.message : 'Query source failed'
      );
      return;
    }

    let queries = peerQueries.get(peer);
    if (!queries) {
      queries = new Map();
      peerQueries.set(peer, queries);
    }
    queries.set(queryId, querySubscription);
  }

  function unsubscribePeerFromAllQueries(peer: Peer) {
    const queries = peerQueries.get(peer);
    if (!queries) {
      return;
    }

    for (const subscription of queries.values()) {
      subscription.unsubscribe();
    }
    peerQueries.delete(peer);
  }

  return {
    open(peer: Peer) {
      logger.log('[ws] open', peer.toString());
    },

    message(peer: Peer, message: WebSocketMessage) {
      const messageText = message.text();
      logger.log('[ws] message', messageText);

      let protocolMessage: ProtocolMessage | undefined;

      try {
        protocolMessage = parseProtocolMessage(messageText);
      } catch (error) {
        logger.error('[ws] invalid JSON message', error);
        sendError(peer, 'Invalid JSON message');
        return;
      }

      if (!protocolMessage) {
        sendError(peer, 'Invalid protocol message');
        return;
      }

      if (protocolMessage.type === 'subscribe') {
        subscribePeer(peer, protocolMessage.key);
        return;
      }

      if (protocolMessage.type === 'unsubscribe') {
        unsubscribePeer(peer, protocolMessage.key);
        return;
      }

      if (protocolMessage.type === 'query') {
        subscribePeerToQuery(
          peer,
          protocolMessage.queryId,
          protocolMessage.query
        );
        return;
      }

      if (protocolMessage.type === 'unquery') {
        unsubscribePeerFromQuery(peer, protocolMessage.queryId);
        return;
      }

      suppressedNotification = {
        peer,
        key: protocolMessage.key,
      };
      let status: OperationStatusMessage;
      try {
        status = liveModel.processOperation(
          protocolMessage.key,
          protocolMessage.operation
        );
      } finally {
        suppressedNotification = undefined;
      }

      if (status.status === 'error') {
        sendError(peer, status.error.message ?? status.error.code);
      }
    },

    close(peer: Peer, event: unknown) {
      unsubscribePeerFromAllKeys(peer);
      unsubscribePeerFromAllQueries(peer);
      logger.log('[ws] close', peer.toString(), event);
    },

    error(peer: Peer, error: unknown) {
      logger.error('[ws] error', peer.toString(), error);
    },
  };
}
