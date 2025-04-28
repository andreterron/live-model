import { Subscriber } from './reactivity/subscriber.js';
import { Subscription } from './reactivity/subscription.js';

export interface Live<T> {
  get(): T;
  subscribe(subscriber: Subscriber<T>): Subscription;

  // Actions
  setValue(value: T): void;
}

export abstract class BaseLive<T> implements Live<T> {
  protected subscribers = new Set<Subscriber<T>>();

  subscribe(subscriber: Subscriber<T>): Subscription {
    this.subscribers.add(subscriber);

    return {
      unsubscribe: () => {
        this.subscribers.delete(subscriber);
      },
    };
  }

  protected notifySubscribers(v: T) {
    this.subscribers.forEach((s) => s.next(v));
  }

  abstract get(): T;
  abstract setValue(value: T): void;
}
