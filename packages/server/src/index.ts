import { serve } from 'crossws/server';
import { serveStatic } from 'srvx/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createLiveModelWebSocket,
  createOperationsHandler,
  SQLiteStorageAdapter,
} from '@live-model/api';
import { BackendLiveModel } from 'live-model';

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const hostname = process.env.HOST ?? '127.0.0.1';
const databasePath = process.env.LIVE_MODEL_DB_PATH ?? 'live-model.sqlite';
const builtPublicDir = fileURLToPath(
  new URL(/* @vite-ignore */ './public', import.meta.url)
);
const publicDir = existsSync(builtPublicDir)
  ? builtPublicDir
  : fileURLToPath(new URL(/* @vite-ignore */ '../public', import.meta.url));

const storage = new SQLiteStorageAdapter(databasePath);
const liveModel = new BackendLiveModel(storage);

const handleOperations = createOperationsHandler(liveModel);

const server = serve({
  middleware: [serveStatic({ dir: publicDir })],
  manual: true,
  hostname,
  port,
  websocket: createLiveModelWebSocket(liveModel),
  fetch: (request) => {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/operations') {
      return handleOperations(request);
    }

    return new Response('Not found', { status: 404 });
  },
});

await server.serve();

console.log(
  `Live Model server listening on ${server.url ?? `http://${hostname}:${port}`}`
);
