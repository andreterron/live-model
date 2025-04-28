import type { ZodType } from 'zod';
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

  onReadError?: 'remove' | 'save_default' | ((e: unknown) => void);

  initializeWithValue?: boolean;
}

export class LocalStorageLive<T> extends BaseLive<T> {
  // We store `lastSerializedValue: string | null` to compare with the existing
  // value in localStorage, which tells us if the value changed or not.
  protected lastSerializedValue: string | null = null;
  protected value: T | undefined;
  constructor(
    protected key: string,
    protected defaultValue: T,
    protected options: LocalStorageLiveOptions<T> = {}
  ) {
    super();
  }

  protected readFromLocalStorage(): { value: T; changed: boolean } {
    const serialized = localStorage.getItem(this.key);
    if (serialized === this.lastSerializedValue) {
      return { value: this.value ?? this.defaultValue, changed: false };
    }

    this.lastSerializedValue = serialized;
    if (!serialized) {
      this.value = undefined;
      return { value: this.defaultValue, changed: true };
    }

    try {
      const deserialized = JSON.parse(serialized);
      if (!this.options.validator) {
        this.value = deserialized as T;
        return { value: this.value, changed: true };
      }

      // Validator
      this.value = this.options.validator.parse(deserialized);
      return {
        value: this.value,
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
        } else if (this.options.onReadError === 'save_default') {
          localStorage.setItem(this.key, JSON.stringify(this.defaultValue));
        } else if (typeof this.options.onReadError === 'function') {
          this.options.onReadError(e);
        }
      } catch (e2) {
        console.error(
          '[LiveModel] Error trying to recover from the previous error'
        );
      }
      this.value = undefined;
      return { value: this.defaultValue, changed: true };
    }
  }

  handleLocalStorageEvent = ((event: StorageEvent) => {
    if (event.key === this.key) {
      const { value, changed } = this.readFromLocalStorage();
      if (changed) {
        this.notifySubscribers(value);
      }
    }
  }).bind(this);

  override subscribe(subscriber: Subscriber<T>): Subscription {
    const needsActivation = this.subscribers.size === 0;
    const subscription = super.subscribe(subscriber);

    const { value, changed } = this.readFromLocalStorage();
    if (changed) {
      // NOTE: This means we can't subscribe on render. It needs to be on useEffect.
      this.notifySubscribers(value);
    } else {
      subscriber.next(value);
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
    const { value, changed } = this.readFromLocalStorage();
    if (changed) {
      this.notifySubscribers(value);
    }
    return value;
  }
  setValue(v: T) {
    try {
      this.value = v;
      // Save to localStorage before notifying subscribers. Other tabs might
      // get the update before the value propagates internally, but that's
      // better than a listener assuming that localStorage already has the
      // new value once they get a notification.
      const serialized = JSON.stringify(v);
      this.lastSerializedValue = serialized;
      localStorage.setItem(this.key, serialized);

      // From usehooks-ts: https://github.com/juliencrn/usehooks-ts/blob/61949134144d3690fe9f521260a16c779a6d3797/packages/usehooks-ts/src/useLocalStorage/useLocalStorage.ts#L140-L141
      // Using the same event name creates interoperability between the two libraries
      // We dispatch a custom event so every similar useLocalStorage hook is notified
      window.dispatchEvent(
        new StorageEvent('local-storage', { key: this.key })
      );

      this.notifySubscribers(v);
    } catch (e) {
      console.error(
        'Failed to serialize value to localstorage',
        { key: this.key, value: v },
        e
      );
    }
  }
}
