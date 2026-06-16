import {
  deleteMessageSchema,
  snapshotMessageSchema,
  type DeleteMessage,
  type SnapshotMessage,
} from '@live-model/protocol';
import type { Subscription } from '../../reactivity/subscription.js';

export interface WebSocketTransportOptions {
  protocols?: string | string[];
  WebSocket?: typeof WebSocket;
}

export interface WebSocketTransportSubscriber {
  message(message: SnapshotMessage | DeleteMessage): void;
  close?(event: CloseEvent): void;
  error?(event: Event): void;
  open?(): void;
}

export interface WebSocketTransportConnection extends Subscription {
  send(message: SnapshotMessage | DeleteMessage): void;
}

type WebSocketTransportConnectionInternal = WebSocketTransportConnection & {
  key: string;
  subscriber: WebSocketTransportSubscriber;
};

export class WebSocketTransport {
  protected static readonly closeDelayMs = 5_000;
  protected socket?: WebSocket;
  protected closeSocketTimeout?: ReturnType<typeof setTimeout>;
  protected pendingMessages: string[] = [];
  protected subscribersByKey = new Map<
    string,
    Set<WebSocketTransportConnectionInternal>
  >();

  constructor(
    protected url: string | URL,
    protected options: WebSocketTransportOptions = {}
  ) {}

  subscribe(
    key: string,
    subscriber: WebSocketTransportSubscriber
  ): WebSocketTransportConnection {
    this.cancelCloseSocketTimeout();

    let connections = this.subscribersByKey.get(key);

    if (!connections) {
      connections = new Set();
      this.subscribersByKey.set(key, connections);
    }

    const connection: WebSocketTransportConnectionInternal = {
      key,
      subscriber,
      send: (message) => {
        this.forwardToSubscribers(connection, message);
        this.send(message);
      },
      unsubscribe: () => {
        connections.delete(connection);

        if (connections.size === 0) {
          this.subscribersByKey.delete(key);
        }

        if (this.subscribersByKey.size === 0) {
          this.scheduleCloseSocket();
        }
      },
    };

    connections.add(connection);
    this.connect();

    return connection;
  }

  protected send(message: SnapshotMessage | DeleteMessage): void {
    const serialized = JSON.stringify(message);
    const WebSocketCtor = this.getWebSocketConstructor();

    this.connect();

    if (this.socket?.readyState !== WebSocketCtor.OPEN) {
      this.pendingMessages.push(serialized);
      return;
    }

    this.socket.send(serialized);
  }

  protected connect() {
    const WebSocketCtor = this.getWebSocketConstructor();

    if (
      this.socket &&
      (this.socket.readyState === WebSocketCtor.CONNECTING ||
        this.socket.readyState === WebSocketCtor.OPEN)
    ) {
      return;
    }

    const socket = new WebSocketCtor(this.url, this.options.protocols);
    this.socket = socket;

    socket.addEventListener('open', this.handleOpen);
    socket.addEventListener('message', this.handleMessage);
    socket.addEventListener('close', this.handleClose);
    socket.addEventListener('error', this.handleError);
  }

  protected getWebSocketConstructor(): typeof WebSocket {
    return this.options.WebSocket ?? WebSocket;
  }

  protected closeSocket() {
    if (!this.socket) {
      return;
    }

    this.cancelCloseSocketTimeout();
    this.socket.removeEventListener('open', this.handleOpen);
    this.socket.removeEventListener('message', this.handleMessage);
    this.socket.removeEventListener('close', this.handleClose);
    this.socket.removeEventListener('error', this.handleError);
    this.socket.close();
    this.socket = undefined;
  }

  protected scheduleCloseSocket() {
    if (this.closeSocketTimeout) {
      return;
    }

    this.closeSocketTimeout = setTimeout(() => {
      this.closeSocketTimeout = undefined;

      if (this.subscribersByKey.size === 0) {
        this.closeSocket();
      }
    }, WebSocketTransport.closeDelayMs);
  }

  protected cancelCloseSocketTimeout() {
    if (!this.closeSocketTimeout) {
      return;
    }

    clearTimeout(this.closeSocketTimeout);
    this.closeSocketTimeout = undefined;
  }

  protected handleOpen = (() => {
    const pendingMessages = this.pendingMessages;
    this.pendingMessages = [];

    for (const message of pendingMessages) {
      this.socket?.send(message);
    }

    for (const subscriber of this.getAllSubscribers()) {
      subscriber.open?.();
    }
  }).bind(this);

  protected handleMessage = ((event: MessageEvent) => {
    if (typeof event.data !== 'string') {
      return;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(event.data);
    } catch (error) {
      console.error('[LiveModel] Failed to parse WebSocket message', error);
      return;
    }

    const message = this.parseMessage(parsed);

    if (!message) {
      return;
    }

    const connections = this.subscribersByKey.get(message.key);

    if (!connections) {
      return;
    }

    for (const connection of connections) {
      connection.subscriber.message(message);
    }
  }).bind(this);

  protected handleClose = ((event: CloseEvent) => {
    this.socket = undefined;

    for (const subscriber of this.getAllSubscribers()) {
      subscriber.close?.(event);
    }
  }).bind(this);

  protected handleError = ((event: Event) => {
    console.error('[LiveModel] WebSocketTransport error', event);

    for (const subscriber of this.getAllSubscribers()) {
      subscriber.error?.(event);
    }
  }).bind(this);

  protected parseMessage(
    value: unknown
  ): SnapshotMessage | DeleteMessage | undefined {
    const snapshotResult = snapshotMessageSchema.safeParse(value);

    if (snapshotResult.success) {
      return snapshotResult.data as SnapshotMessage;
    }

    const deleteResult = deleteMessageSchema.safeParse(value);

    if (deleteResult.success) {
      return deleteResult.data as DeleteMessage;
    }

    return undefined;
  }

  protected forwardToSubscribers(
    sender: WebSocketTransportConnectionInternal,
    message: SnapshotMessage | DeleteMessage
  ) {
    const connections = this.subscribersByKey.get(message.key);

    if (!connections) {
      return;
    }

    for (const connection of connections) {
      if (connection === sender) {
        continue;
      }

      connection.subscriber.message(message);
    }
  }

  protected getAllSubscribers() {
    const subscribers = new Set<WebSocketTransportSubscriber>();

    for (const connectionsForKey of this.subscribersByKey.values()) {
      for (const connection of connectionsForKey) {
        subscribers.add(connection.subscriber);
      }
    }

    return subscribers;
  }
}
