import {
  allKeysKey,
  type LiveStateLike,
  type AnyOperation,
  type ProtocolMessage,
  protocolMessageSchema,
} from '@live-model/protocol';
import type { Message as WebSocketMessage, Peer, WSOptions } from 'crossws';
import { executeOperation } from './operations.js';
import type { StorageAdapter } from './storage-adapter/storage-adapter.js';
import { getStateMessageForKey } from './live-state.js';

interface LiveModelWebSocketLogger {
  error(...args: unknown[]): void;
  log(...args: unknown[]): void;
}

function parseProtocolMessage(text: string): ProtocolMessage | undefined {
  const parsed: unknown = JSON.parse(text);
  const result = protocolMessageSchema.safeParse(parsed);

  if (!result.success) {
    return undefined;
  }

  return result.data as ProtocolMessage;
}

function sendStateMessage(storage: StorageAdapter, peer: Peer, key: string) {
  peer.send(JSON.stringify(getStateMessageForKey(key, storage)));
}

function sendError(peer: Peer, error: string) {
  peer.send(JSON.stringify({ error }));
}

export function createLiveModelWebSocket(
  storage: StorageAdapter,
  logger: LiveModelWebSocketLogger = console
): WSOptions {
  const peerSubscriptions = new Map<Peer, Set<string>>();
  const subscribedPeersByKey = new Map<string, Set<Peer>>();

  function subscribePeer(peer: Peer, key: string) {
    let subscriptions = peerSubscriptions.get(peer);

    if (!subscriptions) {
      subscriptions = new Set();
      peerSubscriptions.set(peer, subscriptions);
    }

    subscriptions.add(key);

    let subscribedPeers = subscribedPeersByKey.get(key);

    if (!subscribedPeers) {
      subscribedPeers = new Set();
      subscribedPeersByKey.set(key, subscribedPeers);
    }

    subscribedPeers.add(peer);
  }

  function unsubscribePeer(peer: Peer, key: string) {
    const subscriptions = peerSubscriptions.get(peer);

    if (subscriptions) {
      subscriptions.delete(key);

      if (subscriptions.size === 0) {
        peerSubscriptions.delete(peer);
      }
    }

    const subscribedPeers = subscribedPeersByKey.get(key);

    if (!subscribedPeers) {
      return;
    }

    subscribedPeers.delete(peer);

    if (subscribedPeers.size === 0) {
      subscribedPeersByKey.delete(key);
    }
  }

  function unsubscribePeerFromAllKeys(peer: Peer) {
    const subscriptions = peerSubscriptions.get(peer);

    if (!subscriptions) {
      return;
    }

    for (const key of subscriptions) {
      const subscribedPeers = subscribedPeersByKey.get(key);

      if (!subscribedPeers) {
        continue;
      }

      subscribedPeers.delete(peer);

      if (subscribedPeers.size === 0) {
        subscribedPeersByKey.delete(key);
      }
    }

    peerSubscriptions.delete(peer);
  }

  function broadcastToSubscribedPeers(
    key: string,
    messageText: string,
    sender?: Peer
  ) {
    const subscribedPeers = subscribedPeersByKey.get(key);

    if (!subscribedPeers) {
      return;
    }

    for (const peer of subscribedPeers) {
      if (peer === sender) {
        continue;
      }

      peer.send(messageText);
    }
  }

  function getProcessedLiveState(
    operation: AnyOperation
  ): LiveStateLike | undefined {
    if (operation.type === 'delete') {
      return { kind: 'absent', reason: 'deleted' };
    }

    return {
      kind: 'value',
      value: operation.data,
    };
  }

  function broadcastStateToOtherPeers(sender: Peer, operation: AnyOperation) {
    const state = getProcessedLiveState(operation);

    if (!state) {
      return;
    }

    broadcastToSubscribedPeers(
      operation.key,
      JSON.stringify({ type: 'state', key: operation.key, state }),
      sender
    );
  }

  function broadcastAllKeysState() {
    const message = JSON.stringify(getStateMessageForKey(allKeysKey, storage));

    broadcastToSubscribedPeers(allKeysKey, message);
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

      // TODO: clean this up. It should be a switch

      if (protocolMessage.type === 'subscribe') {
        subscribePeer(peer, protocolMessage.key);
        sendStateMessage(storage, peer, protocolMessage.key);
        return;
      }

      if (protocolMessage.type === 'unsubscribe') {
        unsubscribePeer(peer, protocolMessage.key);
        return;
      }

      const operation = protocolMessage.operation;

      const status = executeOperation(storage, operation);

      if (status.status === 'error') {
        sendError(peer, status.error.message ?? status.error.code);
        return;
      }

      broadcastStateToOtherPeers(peer, operation);

      // TODO: Only broadcast all keys if a new key was created or a key was deleted
      broadcastAllKeysState();
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
