import type { LiveState } from '@live-model/protocol';
import { LiveDeleter } from '../deleter.js';
import { BaseLive, Live } from '../live.js';
import { Subscriber } from '../reactivity/subscriber.js';
import { Subscription } from '../reactivity/subscription.js';
import { LiveSetter } from '../setter.js';

class MappedLive<T, Input> extends BaseLive<T> {
  protected inputSubscription: Subscription | undefined;

  constructor(
    private live: Live<Input>,
    protected transform: (state: LiveState<Input>) => LiveState<T>,
    protected setter?: LiveSetter<Input, T>,
    protected deleter?: LiveDeleter<Input>
  ) {
    super();
  }

  override get(): LiveState<T> {
    return this.transform(this.live.get());
  }

  override subscribe(subscriber: Subscriber<LiveState<T>>): Subscription {
    const sub = super.subscribe(subscriber);

    if (!this.inputSubscription) {
      this.inputSubscription = this.live.subscribe({
        next: (v) => {
          this.notifyLiveState(this.transform(v));
        },
      });
    } else {
      const state = this.get();
      subscriber.next(state);
    }

    return {
      unsubscribe: () => {
        sub.unsubscribe();
        if (this.subscribers.size === 0) {
          this.inputSubscription?.unsubscribe();
          this.inputSubscription = undefined;
        }
      },
    };
  }

  override setValue(value: T): void {
    if (!this.setter) {
      // no-op
      return;
    }

    this.setter(value, this.live);
  }

  override deleteValue(): void {
    if (!this.deleter) {
      // no-op
      return;
    }

    this.deleter(this.live);
  }
}

export function valueTransform<T, U>(
  transform: (v: T) => U
): (state: LiveState<T>) => LiveState<U> {
  return (state) => {
    if (state.kind !== 'value') {
      return state;
    }
    return { ...state, value: transform(state.value) };
  };
}

export function mapState<T, U>(
  live: Live<T>,
  transform: (state: LiveState<T>) => LiveState<U>,
  setter?: LiveSetter<T, U>,
  deleter?: LiveDeleter<T>
): Live<U> {
  return new MappedLive(live, transform, setter, deleter);
}

export function mapValue<T, U>(
  live: Live<T>,
  transform: (v: T) => U,
  setter?: LiveSetter<T, U>,
  deleter?: LiveDeleter<T>
): Live<U> {
  return mapState(live, valueTransform(transform), setter, deleter);
}
