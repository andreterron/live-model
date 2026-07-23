import {
  LiveState,
  type AnyOperation,
  type OperationResult,
} from '@live-model/protocol';
import { BaseLive } from '../live.js';
import type { Subscriber } from '../reactivity/subscriber.js';
import type { Subscription } from '../reactivity/subscription.js';

export interface StorageAdapter {
  get(key: string): LiveState<unknown>;
  listKeys(): string[];
  set(key: string, data: unknown): boolean;
  delete(key: string): boolean;
}

export interface StorageLiveOptions {
  onKeyMembershipChange?(): void;
}

/** A synchronous Live whose value is owned by a key-value storage adapter. */
export class StorageLive<T> extends BaseLive<T> {
  constructor(
    private readonly key: string,
    private readonly storage: StorageAdapter,
    private readonly options: StorageLiveOptions = {}
  ) {
    super();
  }

  override subscribe(subscriber: Subscriber<LiveState<T>>): Subscription {
    const subscription = super.subscribe(subscriber);
    subscriber.next(this.get());
    return subscription;
  }

  get(): LiveState<T> {
    return this.storage.get(this.key) as LiveState<T>;
  }

  setValue(value: T): void {
    this.op({ type: 'set_value', data: value });
  }

  deleteValue(): void {
    this.op({ type: 'delete' });
  }

  override op(operation: AnyOperation<T>): OperationResult {
    const existedBefore = this.storage.get(this.key).kind === 'value';
    const persisted =
      operation.type === 'delete'
        ? this.storage.delete(this.key)
        : this.storage.set(this.key, operation.data);

    if (!persisted) {
      return {
        status: 'error',
        error: {
          code: 'operation_failed',
          message: 'Operation could not be persisted',
        },
      };
    }

    this.notifyLiveState(
      operation.type === 'delete'
        ? LiveState.absent('deleted')
        : LiveState.value(operation.data)
    );

    const existsAfter = operation.type !== 'delete';
    if (existedBefore !== existsAfter) {
      this.options.onKeyMembershipChange?.();
    }

    return { status: 'success' };
  }
}
