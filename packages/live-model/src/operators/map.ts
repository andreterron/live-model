import { BaseLive, Live } from '../live.js';
import { Subscriber } from '../reactivity/subscriber.js';
import { Subscription } from '../reactivity/subscription.js';
import { LiveSetter } from '../setter.js';

class MappedLive<T, Input> extends BaseLive<T> {
  protected inputSubscription: Subscription | undefined;

  constructor(
    private live: Live<Input>,
    protected transform: (v: Input) => T,
    protected setter?: LiveSetter<Input, T>
  ) {
    super();
  }

  override get(): T {
    return this.transform(this.live.get());
  }

  override subscribe(subscriber: Subscriber<T>): Subscription {
    const sub = super.subscribe(subscriber);

    if (!this.inputSubscription) {
      this.inputSubscription = this.live.subscribe({
        next: (v) => {
          this.notifySubscribers(this.transform(v));
        },
      });
    } else {
      subscriber.next(this.get());
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
}

export function map<T, U>(
  live: Live<T>,
  transform: (v: T) => U,
  setter?: LiveSetter<T, U>
): Live<U> {
  return new MappedLive(live, transform, setter);
}
