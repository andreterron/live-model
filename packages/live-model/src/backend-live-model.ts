import {
  allKeysKey,
  LiveState,
  type Operation,
  type OperationResult,
  type OperationStatusMessage,
} from './protocol.js';
import { StorageLive, type StorageAdapter } from './creators/storage-live.js';
import { BaseLive, type Live } from './live.js';
import type { Subscriber } from './reactivity/subscriber.js';
import type { Subscription } from './reactivity/subscription.js';
import { LiveReferenceCodec, ReferenceResolvingLive } from './references.js';
import { OperationSetRegistry } from './operation-set-registry.js';
import { EntitiesQueryLive } from './query/entities-query-live.js';
import type { LiveQuery } from './query/query-language.js';
import type { QueryResult } from './query/query-result.js';

export type BackendLiveFactory = <T>(key: string) => Live<T>;

class AllKeysLive extends BaseLive<string[], never> {
  constructor(private readonly storage: StorageAdapter) {
    super();
  }

  override subscribe(
    subscriber: Subscriber<LiveState<string[]>>
  ): Subscription {
    const subscription = super.subscribe(subscriber);
    subscriber.next(this.get());
    return subscription;
  }

  get(): LiveState<string[]> {
    return LiveState.value(
      this.storage.listKeys().filter((key) => key !== allKeysKey)
    );
  }

  override setValue(value: string[]): void {
    throw new Error(readOnlyAllKeysMessage());
  }

  override deleteValue(): void {
    throw new Error(readOnlyAllKeysMessage());
  }

  override op(): OperationResult {
    return operationError(readOnlyAllKeysMessage());
  }

  refresh(): void {
    this.notifyLiveState(this.get());
  }
}

function operationError(message: string): OperationResult {
  return {
    status: 'error',
    error: { code: 'operation_failed', message },
  };
}

function readOnlyAllKeysMessage(): string {
  return `The reserved key "${allKeysKey}" is read-only`;
}

function toStatusMessage(result: OperationResult): OperationStatusMessage {
  return { type: 'op_status', ...result };
}

export interface BackendLiveModelOptions {
  createLive?: BackendLiveFactory;
  operationSetRegistry?: OperationSetRegistry;
}

// TODO: Merge BackendLiveModel and its related types with LiveModelClient.
// LiveModelClient's transport dependency should become an implementation or
// configuration concern rather than define a separate Live registry.

/**
 * Owns the canonical backend Lives and routes addressed operations to them.
 * A custom factory can select different Live implementations based on the key.
 */
export class BackendLiveModel {
  readonly operationSetRegistry: OperationSetRegistry;
  private readonly livesByKey = new Map<string, Live<unknown>>();
  private readonly storageLivesByKey = new Map<
    string,
    StorageLive<unknown, Operation>
  >();
  private readonly allKeysLive: AllKeysLive;
  private readonly createLive: BackendLiveFactory;
  private readonly referenceCodec = new LiveReferenceCodec((key) =>
    this.forKey(key)
  );

  constructor(
    private readonly storage: StorageAdapter,
    options: BackendLiveModelOptions = {}
  ) {
    this.operationSetRegistry =
      options.operationSetRegistry ?? new OperationSetRegistry();
    this.allKeysLive = new AllKeysLive(storage);
    this.referenceCodec.register(allKeysKey, this.allKeysLive);
    this.createLive =
      options.createLive ??
      (<T>(key: string) => {
        const live = new StorageLive<T, Operation>(key, this.storage, {
          onKeyMembershipChange: () => this.allKeysLive.refresh(),
          onExternalStateChange: (changedKey) =>
            this.storageLivesByKey.get(changedKey)?.refresh(),
          operationSetRegistry: this.operationSetRegistry,
        });
        this.storageLivesByKey.set(
          key,
          live as StorageLive<unknown, Operation>
        );
        return live;
      });
  }

  forKey<T = unknown>(key: string): Live<T> {
    if (key === allKeysKey) {
      return this.allKeysLive as unknown as Live<T>;
    }

    let live = this.livesByKey.get(key);

    if (!live) {
      const source = this.createLive<unknown>(key);
      live = new ReferenceResolvingLive(source, this.referenceCodec);
      this.livesByKey.set(key, live);
      this.referenceCodec.register(key, live);
    }

    return live as Live<T>;
  }

  encodeReferences(value: unknown): unknown {
    return this.referenceCodec.encode(value);
  }

  query<T = unknown>(query: LiveQuery<T>): Live<QueryResult<T>, never> {
    return new EntitiesQueryLive(
      this.storage,
      (key) => this.forKey<T>(key),
      query
    );
  }

  processOperation(key: string, operation: Operation): OperationStatusMessage {
    if (key === allKeysKey) {
      return toStatusMessage(operationError(readOnlyAllKeysMessage()));
    }

    return toStatusMessage(this.forKey(key).op(operation));
  }
}
