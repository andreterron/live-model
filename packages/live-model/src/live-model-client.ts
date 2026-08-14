import {
  WebSocketLive,
  type WebSocketLiveOptions,
} from './creators/web-socket/web-socket-live.js';
import {
  WebSocketTransport,
  type WebSocketTransportOptions,
} from './creators/web-socket/web-socket-transport.js';
import type { Live } from './live.js';
import { OperationSetRegistry } from './operation-set-registry.js';
import { LiveReferenceCodec, ReferenceResolvingLive } from './references.js';

export interface LiveModelClientOptions {
  websocketUrl?: string | URL;
  transport?: WebSocketTransport;
  transportOptions?: WebSocketTransportOptions;
  operationSetRegistry?: OperationSetRegistry;
}

export class LiveModelClient {
  operationSetRegistry: OperationSetRegistry;
  private readonly livesByKey = new Map<string, Live<unknown>>();
  private readonly referenceCodec = new LiveReferenceCodec((key) =>
    this.forKey(key)
  );
  private transport?: WebSocketTransport;
  private options: LiveModelClientOptions;

  constructor(options: LiveModelClientOptions = {}) {
    this.options = options;
    this.transport = options.transport;
    this.operationSetRegistry =
      options.operationSetRegistry ?? new OperationSetRegistry();
  }

  // TODO: This doesn't update the transport for already-created Lives
  configure(options: LiveModelClientOptions): void {
    this.options = options;
    this.transport = options.transport;
    this.operationSetRegistry =
      options.operationSetRegistry ?? this.operationSetRegistry;
    this.clear();
  }

  forKey<T = unknown>(
    key: string,
    options?: Omit<WebSocketLiveOptions<T>, 'transport'>
  ): Live<T> {
    let live = this.livesByKey.get(key);

    if (!live) {
      const source = new WebSocketLive<unknown>(key, {
        ...options,
        // TODO: if this.transport changes, it won't update existing lives
        transport: this.getTransport(),
      });
      live = new ReferenceResolvingLive<T>(source, this.referenceCodec);
      this.livesByKey.set(key, live);
      this.referenceCodec.register(key, live);
    }

    return live as Live<T>;
  }

  encodeReferences(value: unknown): unknown {
    return this.referenceCodec.encode(value);
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
