import { allKeysKey } from '../protocol.js';
import type { BackendLiveModel } from '../backend-live-model.js';
import type { Subscription } from '../reactivity/subscription.js';
import type {
  QuerySource,
  QuerySourceResult,
  QuerySourceSubscriber,
} from './query-source.js';

export class EntitiesQuerySource implements QuerySource {
  constructor(private readonly liveModel: BackendLiveModel) {}

  // TODO: Refactor query results to return entity references. Queries should
  // own membership, range, and ordering without also subscribing to and
  // embedding every referenced Live's current state.
  query<T = unknown>(
    query: unknown,
    subscriber: QuerySourceSubscriber<T>
  ): Subscription {
    // The first implementation supports only "all entities". Reject other
    // shapes until the entities query language has been defined.
    if (!isEmptyObject(query)) {
      throw new Error('Only an empty entities query is supported');
    }

    // Track the current result membership and one subscription per item so
    // changes to either membership or an item's state can refresh the result.
    let keys: string[] = [];
    let syncingSubscriptions = false;
    const itemSubscriptions = new Map<string, Subscription>();

    // Results are assembled from the Lives' current states. Item subscription
    // callbacks are therefore only signals that a fresh snapshot is needed.
    const publish = () => subscriber.next(this.getResult<T>(keys));

    // Reconcile item subscriptions whenever the all-keys Live changes.
    const synchronizeItems = (nextKeys: string[]) => {
      // A Live emits its current state as soon as it is subscribed to. Suppress
      // those emissions while reconciling so only one complete result is sent.
      syncingSubscriptions = true;

      // Stop observing entities that are no longer query results.
      const nextKeySet = new Set(nextKeys);
      for (const [key, subscription] of itemSubscriptions) {
        if (!nextKeySet.has(key)) {
          subscription.unsubscribe();
          itemSubscriptions.delete(key);
        }
      }

      keys = nextKeys;

      // Start observing newly added entities. Existing subscriptions are kept.
      for (const key of keys) {
        if (itemSubscriptions.has(key)) {
          continue;
        }

        itemSubscriptions.set(
          key,
          this.liveModel.forKey(key).subscribe({
            next() {
              if (!syncingSubscriptions) {
                publish();
              }
            },
          })
        );
      }

      // Publish once after membership and subscriptions are synchronized.
      syncingSubscriptions = false;
      publish();
    };

    // The reserved all-keys Live is the query's membership index. It emits
    // synchronously on subscribe, which also produces the initial query result.
    const keysSubscription = this.liveModel
      .forKey<string[]>(allKeysKey)
      .subscribe({
        next(state) {
          if (state.kind === 'value') {
            synchronizeItems(state.value);
          }
        },
      });

    // Tear down both the membership subscription and every item subscription.
    let unsubscribed = false;
    return {
      unsubscribe() {
        if (unsubscribed) {
          return;
        }

        unsubscribed = true;
        keysSubscription.unsubscribe();
        for (const subscription of itemSubscriptions.values()) {
          subscription.unsubscribe();
        }
        itemSubscriptions.clear();
      },
    };
  }

  private getResult<T>(keys: string[]): QuerySourceResult<T> {
    return {
      items: keys.map((key) => ({
        key,
        state: this.liveModel.forKey<T>(key).get(),
      })),
      range: {
        hasMore: false,
      },
    };
  }
}

function isEmptyObject(value: unknown): value is Record<string, never> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}
