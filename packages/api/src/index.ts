import { serve } from 'crossws/server';
import { serveStatic } from 'srvx/static';

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const hostname = process.env.HOST ?? '127.0.0.1';

const server = serve({
  middleware: [serveStatic({ dir: 'public' })],
  manual: true,
  hostname,
  port,
  websocket: {
    open(peer) {
      console.log('[ws] open', peer.toString());
      peer.send({ user: 'server', message: `Welcome ${peer}!` });
    },

    message(peer, message) {
      console.log('[ws] message', message.toString());

      if (message.text().includes('ping')) {
        peer.send({ user: 'server', message: 'pong' });
        return;
      }

      peer.send({ user: peer.toString(), message: message.toString() });
    },

    close(peer, event) {
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
