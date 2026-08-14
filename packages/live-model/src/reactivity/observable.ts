import { type Propagator } from './propagator/propagator.js';
import { type Subscriber } from './subscriber.js';
import { type Subscription } from './subscription.js';

// TODO: Passing values/operations should probably go through the propagator. Not on a getter basis.

/**
 * NOTE: This class is not yet used. It's supposed to be a reactive value
 * with less complexity than a Live, but following proper signal propagation,
 * unlike RxJS.
 *
 * NOTE: The propagator interface doesn't define what function is called on
 * each node. We should probably create an ObservablePropagator class.
 * Currently, propagation wouldn't happen because it would call
 * ObservableNode.next, which is an empty function.
 */
export class Observable<T = unknown> {
  protected node = new ObservableNode();
  // TODO: no undefined
  value?: T;
  private subscribeFn: (subscriber: Subscriber<T>) => Subscription;
  private activeSubscription?: Subscription;
  constructor(
    private propagator: Propagator<ObservableNode>,
    subscribe: (subscriber: Subscriber<T>) => Subscription
    // initialValue: T
  ) {
    this.subscribeFn = subscribe;
    // this.value = initialValue;
  }

  // TODO: Is this an observable subscribing? if so, we should track the dependency relation
  subscribe(subscriber: ObservableNode<T>): Subscription {
    const isFirstSubscriber = this.node.dependedBy.size === 0;

    // Create dependency.
    // TODO: There might be a better place for this.
    this.node.dependedBy.add(subscriber);
    subscriber.dependsOn.add(this.node);

    // TODO: With this type of propagation, I don't think it would ever make
    // sense to call subscribeFn for many subscriptions. But if we do call
    // subscribeFn for each subscription, we can create a wrapper to share
    // a subscription. We can't do the other way around.
    if (isFirstSubscriber) {
      this.activate();
    }

    return {
      unsubscribe: () => {
        this.node.dependedBy.delete(subscriber);
        // TODO: Is this needed?
        subscriber.dependsOn.delete(this.node);

        const isLastSubscriber = this.node.dependedBy.size === 0;
        if (isLastSubscriber) {
          this.deactivate();
        }
      },
    };
  }

  protected activate() {
    this.activeSubscription = this.subscribeFn({
      next: (v) => {
        this.value = v;
        // TODO: Review this
        // TODO: What do we do with the value?
        // TODO: enqueue children?
        // TODO: subscriber should be enqueued somehow
        // this.propagator.enqueue(subscriber);
        this.node.dependedBy.forEach((n) => {
          this.propagator.enqueue(n);
        });
      },
    });
  }

  protected deactivate() {
    this.activeSubscription?.unsubscribe();
    this.activeSubscription = undefined;
  }
}

export class ObservableNode<T = unknown> implements Subscriber<T> {
  dependsOn = new Set<ObservableNode>();
  dependedBy = new Set<ObservableNode>();

  next(v: T): void {
    // TODO: constructor param? Then it can be used on .map, etc
  }
}
