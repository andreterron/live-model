import {
  type Message,
  type SnapshotMessage,
  protocolMessageSchema,
} from '@live-model/protocol';
import type { Peer } from 'crossws';
import { serve } from 'crossws/server';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { serveStatic } from 'srvx/static';

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const hostname = process.env.HOST ?? '127.0.0.1';
const databasePath = process.env.LIVE_MODEL_DB_PATH ?? 'live-model.sqlite';
const peers = new Set<Peer>();

interface EntityStore {
  selectEntities: StatementSync;
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
    selectEntities: database.prepare(
      'SELECT key, data FROM entities ORDER BY key'
    ),
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
  if (message.type === 'delete') {
    getEntityStore().deleteEntity.run(message.key);
    return true;
  }

  if (!('data' in message)) {
    return false;
  }

  const data = JSON.stringify(message.data);

  if (data === undefined) {
    return false;
  }

  getEntityStore().upsertEntity.run(message.key, data);
  return true;
}

function sendSnapshotMessages(peer: Peer) {
  for (const row of getEntityStore().selectEntities.iterate()) {
    const message: SnapshotMessage = {
      type: 'snapshot',
      key: row.key as string,
      data: JSON.parse(row.data as string),
    };

    peer.send(JSON.stringify(message));
  }
}

function sendError(peer: Peer, error: string) {
  peer.send(JSON.stringify({ error }));
}

function broadcastToOtherPeers(sender: Peer, messageText: string) {
  for (const peer of peers) {
    if (peer === sender) {
      continue;
    }

    peer.send(messageText);
  }
}

const server = serve({
  middleware: [serveStatic({ dir: 'public' })],
  manual: true,
  hostname,
  port,
  websocket: {
    open(peer) {
      sendSnapshotMessages(peer);
      peers.add(peer);
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

      if (!persistMessage(protocolMessage)) {
        sendError(peer, 'Protocol message must include data');
        return;
      }

      broadcastToOtherPeers(peer, messageText);
    },

    close(peer, event) {
      peers.delete(peer);
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
