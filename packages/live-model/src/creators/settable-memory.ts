import { BaseLive } from '../live.js';
import { Subscriber } from '../reactivity/subscriber.js';
import { Subscription } from '../reactivity/subscription.js';

export class SettableMemoryLive<T> extends BaseLive<T> {
  private value: T;
  constructor(initialValue: T) {
    super();
    this.value = initialValue;
  }

  override subscribe(subscriber: Subscriber<T>): Subscription {
    const subscription = super.subscribe(subscriber);
    subscriber.next(this.value);
    return subscription;
  }

  get() {
    return this.value;
  }
  setValue(v: T) {
    this.value = v;
    this.notifySubscribers(v);
  }
}
