import {
  type DeleteMessage,
  type SetValueMessage,
  type StateMessage,
} from '@live-model/protocol';
import { type ZodType } from 'zod';
import { BaseLive } from '../../live.js';
import { Subscriber } from '../../reactivity/subscriber.js';
import { Subscription } from '../../reactivity/subscription.js';
import { LiveState } from '../../value-state.js';
import {
  WebSocketTransport,
  type WebSocketTransportConnection,
} from './web-socket-transport.js';

export interface WebSocketLiveOptions<T> {
  // TODO: Review whether `validator` should be on this Live, or if it should be a Live wrapper
  validator?: ZodType<T, any, any>;
  transport: WebSocketTransport;
}

export class WebSocketLive<T> extends BaseLive<T> {
  protected state: LiveState<T> = LiveState.loading;
  protected transport: WebSocketTransport;
  protected transportConnection?: WebSocketTransportConnection;

  constructor(
    protected key: string,
    protected options: WebSocketLiveOptions<T>
  ) {
    super();
    this.transport = options.transport;
  }

  override subscribe(subscriber: Subscriber<LiveState<T>>): Subscription {
    const needsActivation = this.subscribers.size === 0;
    const subscription = super.subscribe(subscriber);

    subscriber.next(this.state);

    if (needsActivation) {
      this.activateTransport();
    }

    return {
      unsubscribe: () => {
        subscription.unsubscribe();

        if (this.subscribers.size === 0) {
          this.deactivateTransport();
        }
      },
    };
  }

  get(): LiveState<T> {
    return this.state;
  }

  setValue(value: T): void {
    this.state = LiveState.value(value);
    this.sendSetValue(value);
    this.notifyLiveState(this.state);
  }

  deleteValue(): void {
    this.state = LiveState.absent('deleted');
    this.sendDelete();
    this.notifyLiveState(this.state);
  }

  protected sendSetValue(data: T) {
    const message: SetValueMessage<T> = {
      type: 'set_value',
      key: this.key,
      data,
    };

    this.activateTransport();
    this.transportConnection?.send(message);
  }

  protected sendDelete() {
    const message: DeleteMessage = {
      type: 'delete',
      key: this.key,
    };

    this.activateTransport();
    this.transportConnection?.send(message);
  }

  protected activateTransport() {
    if (this.transportConnection) {
      return;
    }

    this.transportConnection = this.transport.subscribe(this.key, {
      message: this.handleMessage,
      close: this.handleClose,
      error: this.handleError,
    });
  }

  protected deactivateTransport() {
    this.transportConnection?.unsubscribe();
    this.transportConnection = undefined;
  }

  protected handleMessage = ((message: StateMessage) => {
    try {
      if (message.state.kind === 'value') {
        const value = this.options.validator
          ? this.options.validator.parse(message.state.value)
          : (message.state.value as T);

        this.state = LiveState.value(value);
      } else {
        this.state = message.state;
      }

      this.notifyLiveState(this.state);
    } catch (error) {
      console.error(
        '[LiveModel] Failed to read WebSocketLive state message',
        error
      );
      this.notifyNonDestructiveError(error);
    }
  }).bind(this);

  protected handleClose = ((_event: CloseEvent) => {
    // TODO: Test what happens if this is closing while loading, but it's because the Live is no longer needed (no more subscribers)
    if (this.state.kind === 'loading') {
      this.state = LiveState.absent('offline');
      this.notifyLiveState(this.state);
    }
  }).bind(this);

  protected handleError = ((event: Event) => {
    console.error('[LiveModel] WebSocketLive error', event);
    this.notifyNonDestructiveError(event);
  }).bind(this);

  protected notifyNonDestructiveError(error: unknown) {
    // NOTE: Adding websocket errors to the value might be overkill. But playing it safe
    if (this.state.kind === 'value') {
      this.state = { kind: 'value', value: this.state.value, error };
      this.notifyLiveState(this.state);
    } else if (this.state.kind === 'loading') {
      this.state = LiveState.absent('error', error);
      this.notifyLiveState(this.state);
    }
  }
}
