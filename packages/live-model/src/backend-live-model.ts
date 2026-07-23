import {
  allKeysKey,
  LiveState,
  type AnyOperation,
  type OperationResult,
  type OperationStatusMessage,
} from '@live-model/protocol';
import { StorageLive, type StorageAdapter } from './creators/storage-live.js';
import { BaseLive, type Live } from './live.js';
import type { Subscriber } from './reactivity/subscriber.js';
import type { Subscription } from './reactivity/subscription.js';

export type BackendLiveFactory = <T>(key: string) => Live<T>;

class AllKeysLive extends BaseLive<string[]> {
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

  setValue(value: string[]): void {
    void value;
    throw new Error(readOnlyAllKeysMessage());
  }

  deleteValue(): void {
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
}

// TODO: Merge BackendLiveModel and its related types with LiveModelClient.
// LiveModelClient's transport dependency should become an implementation or
// configuration concern rather than define a separate Live registry.

/**
 * Owns the canonical backend Lives and routes addressed operations to them.
 * A custom factory can select different Live implementations based on the key.
 */
export class BackendLiveModel {
  private readonly livesByKey = new Map<string, Live<unknown>>();
  private readonly allKeysLive: AllKeysLive;
  private readonly createLive: BackendLiveFactory;

  constructor(
    private readonly storage: StorageAdapter,
    options: BackendLiveModelOptions = {}
  ) {
    this.allKeysLive = new AllKeysLive(storage);
    this.createLive =
      options.createLive ??
      (<T>(key: string) =>
        new StorageLive<T>(key, this.storage, {
          onKeyMembershipChange: () => this.allKeysLive.refresh(),
        }));
  }

  forKey<T = unknown>(key: string): Live<T> {
    if (key === allKeysKey) {
      return this.allKeysLive as unknown as Live<T>;
    }

    let live = this.livesByKey.get(key);

    if (!live) {
      live = this.createLive<unknown>(key);
      this.livesByKey.set(key, live);
    }

    return live as Live<T>;
  }

  processOperation(
    key: string,
    operation: AnyOperation
  ): OperationStatusMessage {
    if (key === allKeysKey) {
      return toStatusMessage(operationError(readOnlyAllKeysMessage()));
    }

    return toStatusMessage(this.forKey(key).op(operation));
  }
}
