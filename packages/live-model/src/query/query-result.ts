import type { LiveState } from '../protocol.js';

export interface QueryResultItem<T = unknown> {
  key: string;
  state: LiveState<T>;
}

export interface QueryResult<T = unknown> {
  items: QueryResultItem<T>[];
  range: {
    hasMore: boolean;
  };
}
