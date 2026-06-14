// import { Message, protocolMessageSchema } from '@live-model/protocol';
import type { Peer } from 'crossws';
import { serve } from 'crossws/server';
import { serveStatic } from 'srvx/static';

const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const hostname = process.env.HOST ?? '127.0.0.1';
const peers = new Set<Peer>();

// function parseProtocolMessage(text: string): Message | undefined {
//   const parsed: unknown = JSON.parse(text);
//   const result = protocolMessageSchema.safeParse(parsed);

//   if (!result.success) {
//     return undefined;
//   }

//   return result.data;
// }

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
      peers.add(peer);
      console.log('[ws] open', peer.toString());
    },

    message(peer, message) {
      const messageText = message.text();
      console.log('[ws] message', messageText);

      // TODO: Validate message (code commented out below)

      // let protocolMessage: Message | undefined;

      // try {
      //   protocolMessage = parseProtocolMessage(messageText);
      // } catch (error) {
      //   console.error('[ws] invalid JSON message', error);
      //   peer.send({ error: 'Invalid JSON message' });
      //   return;
      // }

      // if (!protocolMessage) {
      //   peer.send({ error: 'Invalid protocol message' });
      //   return;
      // }

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
