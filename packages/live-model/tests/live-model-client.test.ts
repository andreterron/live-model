import { LiveModelClient, WebSocketTransport } from '../src/index.js';

describe('LiveModelClient', () => {
  test('returns the same live for the same key', () => {
    const client = new LiveModelClient({
      transport: new WebSocketTransport('ws://live-model.test'),
    });

    expect(client.forKey('people.1')).toBe(client.forKey('people.1'));
  });

  test('returns different lives for different keys', () => {
    const client = new LiveModelClient({
      transport: new WebSocketTransport('ws://live-model.test'),
    });

    expect(client.forKey('people.1')).not.toBe(client.forKey('people.2'));
  });

  test('keeps different clients isolated', () => {
    const firstClient = new LiveModelClient({
      transport: new WebSocketTransport('ws://live-model.test'),
    });
    const secondClient = new LiveModelClient({
      transport: new WebSocketTransport('ws://live-model.test'),
    });

    expect(firstClient.forKey('people.1')).not.toBe(
      secondClient.forKey('people.1')
    );
  });

  test('requires websocket configuration before creating lives', () => {
    const client = new LiveModelClient();

    expect(() => client.forKey('people.1')).toThrow(
      'LiveModelClient requires a websocketUrl or transport'
    );
  });
});
