import {
  type OperationStatusMessage,
  type ProtocolMessage,
  protocolMessageSchema,
} from '@live-model/protocol';
import type { Message as WebSocketMessage, Peer, WSOptions } from 'crossws';
import type { BackendLiveModel, Subscription } from 'live-model';

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
  logger: LiveModelWebSocketLogger = console
): WSOptions {
  const peerSubscriptions = new Map<Peer, Map<string, Subscription>>();
  // TODO: Remove/refactor this synchronous suppression mechanism. Operations
  // should carry origin and operation IDs, and resulting state messages should
  // reference the operation so transports or clients can reconcile safely.
  let suppressedNotification: { peer: Peer; key: string } | undefined;

  function sendState(peer: Peer, key: string) {
    peer.send(
      JSON.stringify({ type: 'state', key, state: liveModel.forKey(key).get() })
    );
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

        peer.send(JSON.stringify({ type: 'state', key, state }));
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
      logger.log('[ws] close', peer.toString(), event);
    },

    error(peer: Peer, error: unknown) {
      logger.error('[ws] error', peer.toString(), error);
    },
  };
}
