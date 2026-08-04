import type { LiveState } from '../protocol.js';
import type { Subscription } from '../reactivity/subscription.js';

export interface QuerySourceItem<T = unknown> {
  key: string;
  state: LiveState<T>;
}

export interface QuerySourceResult<T = unknown> {
  items: QuerySourceItem<T>[];
  range: {
    hasMore: boolean;
    cursor?: string;
  };
}

export interface QuerySourceSubscriber<T = unknown> {
  next(result: QuerySourceResult<T>): void;
  error?(error: unknown): void;
}

/**
 * Executes a query and keeps its subscriber current until unsubscribed.
 *
 * Implementations may execute locally or remotely and may emit synchronously
 * or asynchronously.
 */
export interface QuerySource<Q = unknown> {
  query<T = unknown>(
    query: Q,
    subscriber: QuerySourceSubscriber<T>
  ): Subscription;
}
