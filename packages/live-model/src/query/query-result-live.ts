import { BaseLive } from '../live.js';
import { LiveState, type LiveState as LiveStateType } from '../protocol.js';
import type { Subscriber } from '../reactivity/subscriber.js';
import type { Subscription } from '../reactivity/subscription.js';
import type { QueryResult } from './query-result.js';

export abstract class QueryResultLive<T> extends BaseLive<
  QueryResult<T>,
  never
> {
  private state: LiveStateType<QueryResult<T>> = LiveState.loading;
  private sourceSubscription?: Subscription;

  override subscribe(
    subscriber: Subscriber<LiveStateType<QueryResult<T>>>
  ): Subscription {
    const needsActivation = this.subscribers.size === 0;
    const subscription = super.subscribe(subscriber);
    subscriber.next(this.state);

    if (needsActivation) {
      try {
        const sourceSubscription = this.activate();
        if (this.subscribers.size === 0) {
          sourceSubscription?.unsubscribe();
        } else {
          this.sourceSubscription = sourceSubscription;
        }
      } catch (error) {
        this.publishError(error);
      }
    }

    return {
      unsubscribe: () => {
        subscription.unsubscribe();
        if (this.subscribers.size === 0) {
          this.sourceSubscription?.unsubscribe();
          this.sourceSubscription = undefined;
        }
      },
    };
  }

  get(): LiveStateType<QueryResult<T>> {
    return this.state;
  }

  protected abstract activate(): Subscription | undefined;

  protected publish(result: QueryResult<T>): void {
    this.state = LiveState.value(result);
    this.notifyLiveState(this.state);
  }

  protected publishError(error: unknown): void {
    this.state = LiveState.absent('error', error);
    this.notifyLiveState(this.state);
  }
}
