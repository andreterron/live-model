import { WebSocketTransport } from '../creators/web-socket/web-socket-transport.js';
import { generateId } from '../model/generate-id.js';
import type { Subscription } from '../reactivity/subscription.js';
import type {
  QuerySource,
  QuerySourceItem,
  QuerySourceSubscriber,
} from './query-source.js';

export class WebSocketQuerySource<Q = unknown> implements QuerySource<Q> {
  constructor(private readonly transport: WebSocketTransport) {}

  query<T = unknown>(
    query: Q,
    subscriber: QuerySourceSubscriber<T>
  ): Subscription {
    const queryId = `query_${generateId()}`;

    return this.transport.query(queryId, query, {
      message(message) {
        subscriber.next({
          items: message.items as QuerySourceItem<T>[],
          range: message.range,
        });
      },
      error(error) {
        subscriber.error?.(error);
      },
    });
  }
}
