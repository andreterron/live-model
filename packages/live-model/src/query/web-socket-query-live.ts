import type { WebSocketTransport } from '../creators/web-socket/web-socket-transport.js';
import type { Subscription } from '../reactivity/subscription.js';
import type { LiveQuery } from './query-language.js';
import { QueryResultLive } from './query-result-live.js';

export class WebSocketQueryLive<T> extends QueryResultLive<T> {
  constructor(
    private readonly transport: WebSocketTransport,
    private readonly queryId: string,
    private readonly query: LiveQuery<T>
  ) {
    super();
  }

  protected activate(): Subscription {
    return this.transport.query(this.queryId, this.query, {
      message: (message) => {
        this.publish({
          items: message.items,
          range: message.range,
        });
      },
      error: (error) => this.publishError(error),
    });
  }
}
