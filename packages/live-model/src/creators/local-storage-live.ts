import type { ZodType } from 'zod';
import {
  emptyLiveMetadata,
  liveMetadataSchema,
  LiveState,
  type LiveMetadata,
} from '../protocol.js';
import { BaseLive } from '../live.js';
import { Subscriber } from '../reactivity/subscriber.js';
import { Subscription } from '../reactivity/subscription.js';

// From usehooks-ts: https://github.com/juliencrn/usehooks-ts/blob/61949134144d3690fe9f521260a16c779a6d3797/packages/usehooks-ts/src/useLocalStorage/useLocalStorage.ts#L8-L13
declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface WindowEventMap {
    'local-storage': StorageEvent;
  }
}

export interface LocalStorageLiveOptions<T> {
  validator?: ZodType<T, any, any>;

  onReadError?: 'remove' | ((e: unknown) => void);

  initializeWithValue?: boolean;
}

export class LocalStorageLive<T> extends BaseLive<T> {
  // We store `lastSerializedValue: string | null` to compare with the existing
  // value in localStorage, which tells us if the value changed or not.
  protected lastSerializedValue: string | null = null;
  protected lastSerializedMetadata: string | null = null;
  protected state: LiveState<T> = LiveState.loading;
  constructor(
    protected key: string,
    protected options: LocalStorageLiveOptions<T> = {}
  ) {
    super();
  }

  protected readFromLocalStorage(): {
    state: LiveState<T>;
    changed: boolean;
  } {
    try {
      const serialized = localStorage.getItem(this.key);
      const serializedMetadata = localStorage.getItem(this.metadataKey);
      if (
        serialized === this.lastSerializedValue &&
        serializedMetadata === this.lastSerializedMetadata
      ) {
        return { state: this.state, changed: false };
      }

      this.lastSerializedValue = serialized;
      this.lastSerializedMetadata = serializedMetadata;
      const metadata = serializedMetadata
        ? liveMetadataSchema.parse(JSON.parse(serializedMetadata))
        : emptyLiveMetadata;
      if (!serialized) {
        this.state = LiveState.absent(
          'not_found',
          undefined,
          serializedMetadata ? metadata : undefined
        );
        return { state: this.state, changed: true };
      }

      try {
        const deserialized = JSON.parse(serialized);
        if (!this.options.validator) {
          this.state = LiveState.value(deserialized, metadata);
          return { state: this.state, changed: true };
        }

        // Validator
        this.state = {
          kind: 'value',
          value: this.options.validator.parse(deserialized),
          metadata,
        };
        return {
          state: this.state,
          changed: true,
        };
      } catch (e) {
        console.error(
          `[LiveModel] Failed to read value from localStorage. Key "${this.key}" had string "${serialized}"\n`,
          e
        );

        try {
          if (this.options.onReadError === 'remove') {
            localStorage.removeItem(this.key);
          } else if (typeof this.options.onReadError === 'function') {
            this.options.onReadError(e);
          }
        } catch (e2) {
          console.error(
            '[LiveModel] Error trying to recover from the previous error',
            e2
          );
        }
        this.state = { kind: 'absent', reason: 'error', error: e };
        return { state: this.state, changed: true };
      }
    } catch (error) {
      console.log('[LiveModel] Failed to use localStorage', error);

      this.state = { kind: 'absent', reason: 'error', error: error };
      return { state: this.state, changed: false };
    }
  }

  handleLocalStorageEvent = ((event: StorageEvent) => {
    if (event.key === this.key || event.key === this.metadataKey) {
      const { state, changed } = this.readFromLocalStorage();
      if (changed) {
        this.notifyLiveState(state);
      }
    }
  }).bind(this);

  override subscribe(subscriber: Subscriber<LiveState<T>>): Subscription {
    const needsActivation = this.subscribers.size === 0;
    const subscription = super.subscribe(subscriber);

    const { state, changed } = this.readFromLocalStorage();
    if (changed) {
      // NOTE: This means we can't subscribe on render. It needs to be on useEffect.
      this.notifyLiveState(state);
    } else {
      subscriber.next(state);
    }
    // If it's the first subscription, we need to start listening to localStorage window events.
    if (needsActivation) {
      window.addEventListener('storage', this.handleLocalStorageEvent);
      window.addEventListener('local-storage', this.handleLocalStorageEvent);
    }
    return {
      unsubscribe: () => {
        subscription.unsubscribe();
        // If it's the last unsubscribe, we need to stop listening to localStorage window events.
        if (this.subscribers.size === 0) {
          window.removeEventListener('storage', this.handleLocalStorageEvent);
          window.removeEventListener(
            'local-storage',
            this.handleLocalStorageEvent
          );
        }
      },
    };
  }

  get() {
    const { state, changed } = this.readFromLocalStorage();
    if (changed) {
      this.notifyLiveState(state);
    }
    return state;
  }

  protected override applySetValueOperation(v: T) {
    try {
      const metadata =
        this.state.kind === 'loading'
          ? emptyLiveMetadata
          : this.state.metadata ?? emptyLiveMetadata;
      this.state = LiveState.value(v, metadata);
      // Save to localStorage before notifying subscribers. Other tabs might
      // get the update before the value propagates internally, but that's
      // better than a listener assuming that localStorage already has the
      // new value once they get a notification.
      const serialized = JSON.stringify(v);
      this.lastSerializedValue = serialized;
      localStorage.setItem(this.key, serialized);

      this.notifyLocalStorage();
      this.notifySubscribers(v);
    } catch (e) {
      console.error(
        'Failed to serialize value to localstorage',
        { key: this.key, value: v },
        e
      );
    }
  }

  // NOTE: Copy-pasted from the setValue function above. Keep them in sync
  protected override applyDeleteOperation() {
    try {
      const metadata =
        this.state.kind === 'loading' ? undefined : this.state.metadata;
      this.state = LiveState.absent('deleted', undefined, metadata);
      // Delete from localStorage before notifying subscribers. Other tabs might
      // get the update before the value propagates internally, but that's
      // better than a listener assuming that localStorage already has the
      // new value once they get a notification.
      this.lastSerializedValue = null;
      localStorage.removeItem(this.key);

      this.notifyLocalStorage();
      this.notifyLiveState(this.state);
    } catch (e) {
      console.error('Failed to delete value', { key: this.key }, e);
    }
  }

  protected override applySetMetadataOperation(metadata: LiveMetadata): void {
    try {
      const serialized = JSON.stringify(metadata);
      this.lastSerializedMetadata = serialized;
      localStorage.setItem(this.metadataKey, serialized);

      this.state =
        this.state.kind === 'value'
          ? LiveState.value(this.state.value, metadata)
          : LiveState.absent(
              this.state.kind === 'absent' ? this.state.reason : undefined,
              this.state.kind === 'absent' ? this.state.error : undefined,
              metadata
            );
      this.notifyLiveState(this.state);

      this.notifyLocalStorage(this.metadataKey);
    } catch (error) {
      console.error('Failed to serialize metadata to localStorage', error);
    }
  }

  protected notifyLocalStorage(key = this.key) {
    // From usehooks-ts: https://github.com/juliencrn/usehooks-ts/blob/61949134144d3690fe9f521260a16c779a6d3797/packages/usehooks-ts/src/useLocalStorage/useLocalStorage.ts#L140-L141
    // Using the same event name creates interoperability between the two libraries
    // We dispatch a custom event so every similar useLocalStorage hook is notified
    window.dispatchEvent(new StorageEvent('local-storage', { key }));
  }

  private get metadataKey(): string {
    return `${this.key}/$metadata`;
  }
}
