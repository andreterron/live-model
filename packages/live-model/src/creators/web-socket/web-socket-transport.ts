import {
  deleteMessageSchema,
  setValueMessageSchema,
  stateMessageSchema,
  type DeleteMessage,
  type SetValueMessage,
  type StateMessage,
  type SubscribeMessage,
  type UnsubscribeMessage,
} from '@live-model/protocol';
import type { Subscription } from '../../reactivity/subscription.js';

export interface WebSocketTransportOptions {
  protocols?: string | string[];
  WebSocket?: typeof WebSocket;
}

export interface WebSocketTransportSubscriber {
  message(message: StateMessage): void;
  close?(event: CloseEvent): void;
  error?(event: Event): void;
  open?(): void;
}

export interface WebSocketTransportConnection extends Subscription {
  send(message: WebSocketTransportWriteMessage): void;
}

export type WebSocketTransportIncomingMessage = StateMessage;

export type WebSocketTransportWriteMessage = SetValueMessage | DeleteMessage;

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
  protected unsubscribeTimeoutsByKey = new Map<
    string,
    ReturnType<typeof setTimeout>
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

    const isFirstConnectionForKey = !connections;

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
          this.scheduleUnsubscribe(key);
        }

        if (this.subscribersByKey.size === 0) {
          this.scheduleCloseSocket();
        }
      },
    };

    connections.add(connection);
    this.cancelUnsubscribe(key);
    this.connect();

    if (isFirstConnectionForKey) {
      this.sendSubscribe(key);
    }

    return connection;
  }

  protected send(
    message:
      | WebSocketTransportWriteMessage
      | SubscribeMessage
      | UnsubscribeMessage
  ): void {
    const serialized = JSON.stringify(message);
    const WebSocketCtor = this.getWebSocketConstructor();

    this.connect();

    if (this.socket?.readyState !== WebSocketCtor.OPEN) {
      this.pendingMessages.push(serialized);
      return;
    }

    this.socket.send(serialized);
  }

  protected sendSubscribe(key: string): void {
    this.send({
      type: 'subscribe',
      key,
    });
  }

  protected sendUnsubscribe(key: string): void {
    this.send({
      type: 'unsubscribe',
      key,
    });
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

  protected scheduleUnsubscribe(key: string) {
    if (this.unsubscribeTimeoutsByKey.has(key)) {
      return;
    }

    const timeout = setTimeout(() => {
      this.unsubscribeTimeoutsByKey.delete(key);

      if (!this.subscribersByKey.has(key) && this.socket) {
        this.sendUnsubscribe(key);
      }
    }, WebSocketTransport.closeDelayMs);

    this.unsubscribeTimeoutsByKey.set(key, timeout);
  }

  protected cancelCloseSocketTimeout() {
    if (!this.closeSocketTimeout) {
      return;
    }

    clearTimeout(this.closeSocketTimeout);
    this.closeSocketTimeout = undefined;
  }

  protected cancelUnsubscribe(key: string) {
    const timeout = this.unsubscribeTimeoutsByKey.get(key);

    if (!timeout) {
      return;
    }

    clearTimeout(timeout);
    this.unsubscribeTimeoutsByKey.delete(key);
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
  ): WebSocketTransportIncomingMessage | undefined {
    const stateResult = stateMessageSchema.safeParse(value);

    if (stateResult.success) {
      return stateResult.data as StateMessage;
    }

    return this.parseActionMessageAsState(value);
  }

  protected forwardToSubscribers(
    sender: WebSocketTransportConnectionInternal,
    message: WebSocketTransportWriteMessage
  ) {
    const connections = this.subscribersByKey.get(message.key);

    if (!connections) {
      return;
    }

    for (const connection of connections) {
      if (connection === sender) {
        continue;
      }

      connection.subscriber.message(this.actionMessageToState(message));
    }
  }

  protected parseActionMessageAsState(
    value: unknown
  ): StateMessage | undefined {
    const setValueResult = setValueMessageSchema.safeParse(value);

    if (setValueResult.success) {
      return this.actionMessageToState(setValueResult.data as SetValueMessage);
    }

    const deleteResult = deleteMessageSchema.safeParse(value);

    if (deleteResult.success) {
      return this.actionMessageToState(deleteResult.data as DeleteMessage);
    }

    return undefined;
  }

  protected actionMessageToState(
    message: WebSocketTransportWriteMessage
  ): StateMessage {
    if (message.type === 'set_value') {
      return {
        type: 'state',
        key: message.key,
        state: {
          kind: 'value',
          value: message.data,
        },
      };
    }

    return {
      type: 'state',
      key: message.key,
      state: {
        kind: 'absent',
        reason: 'deleted',
      },
    };
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
