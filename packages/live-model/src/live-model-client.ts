import {
  WebSocketLive,
  type WebSocketLiveOptions,
} from './creators/web-socket/web-socket-live.js';
import {
  WebSocketTransport,
  type WebSocketTransportOptions,
} from './creators/web-socket/web-socket-transport.js';

export interface LiveModelClientOptions {
  websocketUrl?: string | URL;
  transport?: WebSocketTransport;
  transportOptions?: WebSocketTransportOptions;
}

export class LiveModelClient {
  private readonly livesByKey = new Map<string, WebSocketLive<unknown>>();
  private transport?: WebSocketTransport;
  private options: LiveModelClientOptions;

  constructor(options: LiveModelClientOptions = {}) {
    this.options = options;
    this.transport = options.transport;
  }

  // TODO: This doesn't update the transport for already-created Lives
  configure(options: LiveModelClientOptions): void {
    this.options = options;
    this.transport = options.transport;
    this.clear();
  }

  forKey<T = unknown>(
    key: string,
    options?: Omit<WebSocketLiveOptions<T>, 'transport'>
  ): WebSocketLive<T> {
    let live = this.livesByKey.get(key);

    if (!live) {
      live = new WebSocketLive<T>(key, {
        ...options,
        // TODO: if this.transport changes, it won't update existing lives
        transport: this.getTransport(),
      });
      this.livesByKey.set(key, live);
    }

    return live as WebSocketLive<T>;
  }

  clear(): void {
    // TODO: Decide how to clear unused cached Lives later.
    this.livesByKey.clear();
  }

  // TODO: Weird that the transport is created lazily
  protected getTransport(): WebSocketTransport {
    if (this.transport) {
      return this.transport;
    }

    if (!this.options.websocketUrl) {
      // TODO: We shouldn't throw
      throw new Error(
        '[LiveModel] LiveModelClient requires a websocketUrl or transport'
      );
    }

    this.transport = new WebSocketTransport(
      this.options.websocketUrl,
      this.options.transportOptions
    );
    return this.transport;
  }
}

// TODO: Questionable. React might need to use useContext
export const defaultLiveModelClient = new LiveModelClient();

// TODO: This doesn't impact already-created Lives
export function configureLiveModel(options: LiveModelClientOptions): void {
  defaultLiveModelClient.configure(options);
}
