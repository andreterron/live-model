import {
  allKeysKey,
  type LiveStateLike,
  type Message as ProtocolMessage,
  type StateMessage,
  protocolMessageSchema,
} from '@live-model/protocol';
import type { Message as WebSocketMessage, Peer, WSOptions } from 'crossws';

export interface LiveModelWebSocketStore {
  getLiveState(key: string): LiveStateLike;
  persistMessage(message: ProtocolMessage): boolean;
}

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

  return result.data;
}

function createStateMessage(key: string, state: LiveStateLike): StateMessage {
  return {
    type: 'state',
    key,
    state,
  };
}

function sendStateMessage(
  store: LiveModelWebSocketStore,
  peer: Peer,
  key: string
) {
  peer.send(JSON.stringify(createStateMessage(key, store.getLiveState(key))));
}

function sendError(peer: Peer, error: string) {
  peer.send(JSON.stringify({ error }));
}

export function createLiveModelWebSocket(
  store: LiveModelWebSocketStore,
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
    message: ProtocolMessage
  ): LiveStateLike | undefined {
    if (message.type === 'delete') {
      return { kind: 'absent', reason: 'deleted' };
    }

    if (message.type === 'set_value') {
      return {
        kind: 'value',
        value: message.data,
      };
    }

    return undefined;
  }

  function broadcastStateToOtherPeers(sender: Peer, message: ProtocolMessage) {
    const state = getProcessedLiveState(message);

    if (!state) {
      return;
    }

    broadcastToSubscribedPeers(
      message.key,
      JSON.stringify(createStateMessage(message.key, state)),
      sender
    );
  }

  function broadcastAllKeysState() {
    const message = JSON.stringify(
      createStateMessage(allKeysKey, store.getLiveState(allKeysKey))
    );

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

      if (protocolMessage.type === 'subscribe') {
        subscribePeer(peer, protocolMessage.key);
        sendStateMessage(store, peer, protocolMessage.key);
        return;
      }

      if (protocolMessage.type === 'unsubscribe') {
        unsubscribePeer(peer, protocolMessage.key);
        return;
      }

      if (!store.persistMessage(protocolMessage)) {
        sendError(peer, 'Protocol message must include data');
        return;
      }

      broadcastStateToOtherPeers(peer, protocolMessage);
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
