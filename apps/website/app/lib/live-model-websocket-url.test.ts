import { describe, expect, test } from 'vitest';

import { getLiveModelWebSocketUrl } from './live-model-websocket-url';

describe('getLiveModelWebSocketUrl', () => {
  test('uses a same-origin websocket path through the public HTTPS tunnel', () => {
    expect(
      getLiveModelWebSocketUrl({
        href: 'https://live-model.terron.ai/explore',
      }).toString()
    ).toBe('wss://live-model.terron.ai/live-model');
  });

  test('uses the website dev server proxy locally', () => {
    expect(
      getLiveModelWebSocketUrl({
        href: 'http://localhost:4200/explore',
      }).toString()
    ).toBe('ws://localhost:4200/live-model');
  });

  test('connects directly to the protocol server during SSR', () => {
    expect(getLiveModelWebSocketUrl()).toBe('ws://127.0.0.1:3001/live-model');
  });
});
