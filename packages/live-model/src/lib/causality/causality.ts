export type Message = any;
export type Action = any;

export interface Subscription {
  unsubscribe(): void;
}

export class Subscribable {
  protected subscribers = new Set<Subscriber>();
  subscribe(subscriber: Subscriber): Subscription {
    this.subscribers.add(subscriber);

    return {
      unsubscribe: () => {
        this.subscribers.delete(subscriber);
      },
    };
  }
}

// TODO: Separate Source and Subscribable
export class Source extends Subscribable {
  dispatch(action: Action) {
    for (let subscriber of this.subscribers) {
      // Use action
      subscriber.notification(action);
    }
  }
}

export interface Subscriber {
  notification(action: Action): void;
}
