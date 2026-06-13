import { BaseLive } from '../live.js';
import { LiveState } from '../value-state.js';
import { Subscriber } from '../reactivity/subscriber.js';
import { Subscription } from '../reactivity/subscription.js';

export class SettableMemoryLive<T> extends BaseLive<T> {
  private state: LiveState<T>;
  constructor(initialValue: T) {
    super();
    this.state = { kind: 'value', value: initialValue };
  }

  override subscribe(subscriber: Subscriber<LiveState<T>>): Subscription {
    const subscription = super.subscribe(subscriber);
    subscriber.next(this.state);
    return subscription;
  }

  get(): LiveState<T> {
    return this.state;
  }

  setValue(v: T) {
    this.state = { kind: 'value', value: v };
    this.notifyLiveState(this.state);
  }

  override deleteValue(): void {
    this.state = { kind: 'absent', reason: 'deleted' };
    this.notifyLiveState(this.state);
  }
}
