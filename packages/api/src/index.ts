import {
  allKeysKey,
  type LiveStateLike,
  type Message,
  type StateMessage,
  protocolMessageSchema,
} from '@live-model/protocol';
import type { Peer } from 'crossws';
import { serve } from 'crossws/server';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { serveStatic } from 'srvx/static';

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const hostname = process.env.HOST ?? '127.0.0.1';
const databasePath = process.env.LIVE_MODEL_DB_PATH ?? 'live-model.sqlite';
const peerSubscriptions = new Map<Peer, Set<string>>();
const subscribedPeersByKey = new Map<string, Set<Peer>>();

interface EntityStore {
  selectEntity: StatementSync;
  selectKeys: StatementSync;
  upsertEntity: StatementSync;
  deleteEntity: StatementSync;
}

let entityStore: EntityStore | undefined;

function getEntityStore(): EntityStore {
  if (entityStore) {
    return entityStore;
  }

  const database = new DatabaseSync(databasePath);

  database.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);

  entityStore = {
    selectEntity: database.prepare('SELECT data FROM entities WHERE key = ?'),
    // Temporary explorer support. The final API will not expose key listing,
    // so this intentionally uses a simple full-table key scan.
    selectKeys: database.prepare('SELECT key FROM entities ORDER BY key'),
    upsertEntity: database.prepare(`
      INSERT INTO entities (key, data)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET data = excluded.data
    `),
    deleteEntity: database.prepare('DELETE FROM entities WHERE key = ?'),
  };

  return entityStore;
}

function parseProtocolMessage(text: string): Message | undefined {
  const parsed: unknown = JSON.parse(text);
  const result = protocolMessageSchema.safeParse(parsed);

  if (!result.success) {
    return undefined;
  }

  return result.data;
}

function persistMessage(message: Message): boolean {
  if (message.key === allKeysKey) {
    return false;
  }

  if (message.type === 'delete') {
    getEntityStore().deleteEntity.run(message.key);
    return true;
  }

  if (message.type !== 'set_value') {
    return false;
  }

  const data = JSON.stringify(message.data);

  if (data === undefined) {
    return false;
  }

  getEntityStore().upsertEntity.run(message.key, data);
  return true;
}

function getProcessedLiveState(message: Message): LiveStateLike | undefined {
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

function getLiveState(key: string): LiveStateLike {
  if (key === allKeysKey) {
    return {
      kind: 'value',
      value: getAllKeys(),
    };
  }

  const row = getEntityStore().selectEntity.get(key);

  if (!row) {
    return { kind: 'absent', reason: 'not_found' };
  }

  return {
    kind: 'value',
    value: JSON.parse((row as { data: string }).data),
  };
}

function getAllKeys(): string[] {
  return getEntityStore()
    .selectKeys.all()
    .map((row) => row.key as string)
    .filter((key) => key !== allKeysKey);
}

function createStateMessage(key: string, state: LiveStateLike): StateMessage {
  return {
    type: 'state',
    key,
    state,
  };
}

function sendStateMessage(peer: Peer, key: string) {
  peer.send(JSON.stringify(createStateMessage(key, getLiveState(key))));
}

function sendError(peer: Peer, error: string) {
  peer.send(JSON.stringify({ error }));
}

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

function broadcastStateToOtherPeers(sender: Peer, message: Message) {
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
    createStateMessage(allKeysKey, getLiveState(allKeysKey))
  );

  const subscribedPeers = subscribedPeersByKey.get(allKeysKey);

  if (!subscribedPeers) {
    return;
  }

  for (const peer of subscribedPeers) {
    peer.send(message);
  }
}

const server = serve({
  middleware: [serveStatic({ dir: 'public' })],
  manual: true,
  hostname,
  port,
  websocket: {
    open(peer) {
      console.log('[ws] open', peer.toString());
    },

    message(peer, message) {
      const messageText = message.text();
      console.log('[ws] message', messageText);

      let protocolMessage: Message | undefined;

      try {
        protocolMessage = parseProtocolMessage(messageText);
      } catch (error) {
        console.error('[ws] invalid JSON message', error);
        sendError(peer, 'Invalid JSON message');
        return;
      }

      if (!protocolMessage) {
        sendError(peer, 'Invalid protocol message');
        return;
      }

      if (protocolMessage.type === 'subscribe') {
        subscribePeer(peer, protocolMessage.key);
        sendStateMessage(peer, protocolMessage.key);
        return;
      }

      if (protocolMessage.type === 'unsubscribe') {
        unsubscribePeer(peer, protocolMessage.key);
        return;
      }

      if (!persistMessage(protocolMessage)) {
        sendError(peer, 'Protocol message must include data');
        return;
      }

      broadcastStateToOtherPeers(peer, protocolMessage);
      broadcastAllKeysState();
    },

    close(peer, event) {
      unsubscribePeerFromAllKeys(peer);
      console.log('[ws] close', peer.toString(), event);
    },

    error(peer, error) {
      console.error('[ws] error', peer.toString(), error);
    },
  },
  fetch: () => new Response('Not found', { status: 404 }),
});

await server.serve();

console.log(
  `API server listening on ${server.url ?? `http://${hostname}:${port}`}`
);
