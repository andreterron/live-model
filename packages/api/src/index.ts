import {
  allKeysKey,
  type LiveStateLike,
  type Message,
} from '@live-model/protocol';
import { serve } from 'crossws/server';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { serveStatic } from 'srvx/static';
import {
  createLiveModelWebSocket,
  type LiveModelWebSocketStore,
} from './live-model-websocket.js';

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const hostname = process.env.HOST ?? '127.0.0.1';
const databasePath = process.env.LIVE_MODEL_DB_PATH ?? 'live-model.sqlite';

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

const store: LiveModelWebSocketStore = {
  getLiveState,
  persistMessage,
};

const server = serve({
  middleware: [serveStatic({ dir: 'public' })],
  manual: true,
  hostname,
  port,
  websocket: createLiveModelWebSocket(store),
  fetch: () => new Response('Not found', { status: 404 }),
});

await server.serve();

console.log(
  `API server listening on ${server.url ?? `http://${hostname}:${port}`}`
);
