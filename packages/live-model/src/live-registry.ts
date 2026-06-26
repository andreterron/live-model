import {
  WebSocketLive,
  type WebSocketLiveOptions,
} from './creators/web-socket/web-socket-live.js';

export class LiveRegistry {
  private static readonly livesByKey = new Map<
    string,
    WebSocketLive<unknown>
  >();

  static forKey<T = unknown>(
    key: string,
    options?: WebSocketLiveOptions<T>
  ): WebSocketLive<T> {
    let live = LiveRegistry.livesByKey.get(key);

    if (!live) {
      live = new WebSocketLive<T>(key, options);
      LiveRegistry.livesByKey.set(key, live);
    }

    return live as WebSocketLive<T>;
  }

  static clear() {
    // TODO: Decide how to clear unused cached Lives later.
    LiveRegistry.livesByKey.clear();
  }
}
