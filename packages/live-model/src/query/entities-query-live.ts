import type { StorageAdapter } from '../creators/storage-live.js';
import type { Live } from '../live.js';
import { allKeysKey } from '../protocol.js';
import {
  createLiveFilterGuard,
  normalizeLiveQuery,
  type LiveQuery,
  type NormalizedLiveQuery,
} from './query-language.js';
import type { QueryResult } from './query-result.js';
import { QueryResultLive } from './query-result-live.js';

export class EntitiesQueryLive<T> extends QueryResultLive<T> {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly resolveEntity: (key: string) => Live<T>,
    private readonly query: LiveQuery<T>
  ) {
    super();
  }

  protected activate(): undefined {
    this.publish(this.executeEntityQuery());
    return undefined;
  }

  private executeEntityQuery(): QueryResult<T> {
    const query = normalizeLiveQuery(
      this.query
    ) as NormalizedLiveQuery<unknown>;
    const storageResult = this.storage.queryKeys
      ? this.storage.queryKeys(query)
      : this.queryStorageKeys(query);

    return {
      items: storageResult.keys.map((key) => ({
        key,
        state: this.resolveEntity(key).get(),
      })),
      range: { hasMore: storageResult.hasMore },
    };
  }

  private queryStorageKeys(query: NormalizedLiveQuery): {
    keys: string[];
    hasMore: boolean;
  } {
    const matches = createLiveFilterGuard(query.filter);
    const keys: string[] = [];

    for (const key of this.storage.listKeys()) {
      if (key === allKeysKey) {
        continue;
      }

      const state = this.storage.get(key);
      if (state.kind !== 'value' || !matches(state.value)) {
        continue;
      }

      if (keys.length === query.limit) {
        return { keys, hasMore: true };
      }
      keys.push(key);
    }

    return { keys, hasMore: false };
  }
}
