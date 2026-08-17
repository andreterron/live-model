import {
  liveMetadataSchema,
  LiveState,
  type DefaultOperations,
  type LiveMetadata,
  type Operation,
  type OperationArgs,
  type OperationError,
  type OperationName,
  type OperationResult,
} from '../protocol.js';
import { BaseLive, toOperation } from '../live.js';
import {
  OperationSetRegistry,
  type OperationSetEffect,
} from '../operation-set-registry.js';
import type { Subscriber } from '../reactivity/subscriber.js';
import type { Subscription } from '../reactivity/subscription.js';
import type { NormalizedLiveQuery } from '../query/query-language.js';

export interface StorageQueryResult {
  keys: string[];
  hasMore: boolean;
}

export interface StorageAdapter {
  get(key: string): LiveState<unknown>;
  listKeys(): string[];
  set(key: string, data: unknown): boolean;
  setMetadata(key: string, metadata: LiveMetadata): boolean;
  delete(key: string): boolean;
  queryKeys?(query: NormalizedLiveQuery<unknown>): StorageQueryResult;
}

export interface StorageLiveOptions {
  onKeyMembershipChange?(): void;
  onExternalStateChange?(key: string): void;
  operationSetRegistry?: OperationSetRegistry;
}

/** A synchronous Live whose value is owned by a key-value storage adapter. */
export class StorageLive<
  T,
  OPS extends Operation = DefaultOperations<T>
> extends BaseLive<T, OPS> {
  private readonly operationSetRegistry: OperationSetRegistry;

  constructor(
    private readonly key: string,
    private readonly storage: StorageAdapter,
    private readonly options: StorageLiveOptions = {}
  ) {
    super();
    this.operationSetRegistry =
      options.operationSetRegistry ?? new OperationSetRegistry();
  }

  override subscribe(subscriber: Subscriber<LiveState<T>>): Subscription {
    const subscription = super.subscribe(subscriber);
    subscriber.next(this.get());
    return subscription;
  }

  get(): LiveState<T> {
    return this.storage.get(this.key) as LiveState<T>;
  }

  override op(operation: OPS): OperationResult;
  override op<K extends OperationName<OPS>>(
    type: K,
    ...args: OperationArgs<OPS, K>
  ): OperationResult;
  override op(
    operationOrType: OPS | OperationName<OPS>,
    ...args: unknown[]
  ): OperationResult {
    const operation = toOperation<OPS>(operationOrType, args);
    const currentState = this.storage.get(this.key);
    const existedBefore = currentState.kind === 'value';

    if (operation.type === 'set_metadata') {
      const parsed = liveMetadataSchema.safeParse(
        'data' in operation ? operation.data : undefined
      );
      if (!parsed.success) {
        return operationError(
          'invalid_operation',
          'set_metadata requires valid Live metadata'
        );
      }
      return this.persistMetadata(parsed.data, currentState);
    }

    const result = this.operationSetRegistry.process(currentState, operation, {
      key: this.key,
    });
    if (result.status === 'error') {
      return result;
    }

    return this.persistEffects(result.effects, existedBefore);
  }

  refresh(): void {
    this.notifyLiveState(this.get());
  }

  private persistEffects(
    effects: readonly OperationSetEffect[],
    currentKeyExistedBefore: boolean
  ): OperationResult {
    if (effects.length === 0) {
      return { status: 'success' };
    }

    const existedBefore = new Map<string, boolean>([
      [this.key, currentKeyExistedBefore],
    ]);
    const changedKeys = new Set<string>();
    let currentKeyWasDeleted = false;

    // TODO: Let adapters apply the complete effect list atomically.
    for (const effect of effects) {
      if (!existedBefore.has(effect.key)) {
        existedBefore.set(
          effect.key,
          this.storage.get(effect.key).kind === 'value'
        );
      }

      const persisted =
        effect.type === 'set'
          ? this.storage.set(effect.key, effect.value)
          : effect.type === 'set_metadata'
          ? this.storage.setMetadata(effect.key, effect.metadata)
          : this.storage.delete(effect.key);

      if (!persisted) {
        return operationError(
          'operation_failed',
          'Operation could not be persisted'
        );
      }

      changedKeys.add(effect.key);
      if (effect.key === this.key) {
        currentKeyWasDeleted = effect.type === 'delete';
      }
    }

    if (changedKeys.has(this.key)) {
      this.notifyLiveState(
        currentKeyWasDeleted
          ? LiveState.absent('deleted')
          : (this.storage.get(this.key) as LiveState<T>)
      );
    }

    for (const key of changedKeys) {
      if (key !== this.key) {
        this.options.onExternalStateChange?.(key);
      }
    }

    if (
      [...changedKeys].some(
        (key) =>
          existedBefore.get(key) !== (this.storage.get(key).kind === 'value')
      )
    ) {
      this.options.onKeyMembershipChange?.();
    }

    return { status: 'success' };
  }

  private persistMetadata(
    metadata: LiveMetadata,
    currentState: LiveState<unknown>
  ): OperationResult {
    if (!this.storage.setMetadata(this.key, metadata)) {
      return operationError(
        'operation_failed',
        'Metadata could not be persisted'
      );
    }

    const state =
      currentState.kind === 'value'
        ? LiveState.value(currentState.value as T, metadata)
        : LiveState.absent(
            currentState.kind === 'absent' ? currentState.reason : undefined,
            currentState.kind === 'absent' ? currentState.error : undefined,
            metadata
          );
    this.notifyLiveState(state);
    return { status: 'success' };
  }
}

function operationError(
  code: string,
  message: string
): { status: 'error'; error: OperationError } {
  return {
    status: 'error',
    error: { code, message },
  };
}
