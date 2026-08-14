import {
  emptyLiveMetadata,
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
import { OperationSetRegistry } from '../operation-set-registry.js';
import type { Subscriber } from '../reactivity/subscriber.js';
import type { Subscription } from '../reactivity/subscription.js';

export interface StorageAdapter {
  get(key: string): LiveState<unknown>;
  listKeys(): string[];
  set(key: string, data: unknown): boolean;
  setMetadata(key: string, metadata: LiveMetadata): boolean;
  delete(key: string): boolean;
}

export interface StorageLiveOptions {
  onKeyMembershipChange?(): void;
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

    const result = this.operationSetRegistry.process(currentState, operation);
    if (result.status === 'error') {
      return result;
    }

    if (result.action === 'unchanged') {
      return { status: 'success' };
    }

    if (result.action === 'delete') {
      return this.persistDelete(existedBefore);
    }

    return this.persistValue(
      result.value,
      existedBefore,
      currentState.kind === 'loading'
        ? emptyLiveMetadata
        : currentState.metadata ?? emptyLiveMetadata
    );
  }

  // TODO: Move persistence of processing effects into a reusable processor.
  private persistValue(
    value: unknown,
    existedBefore: boolean,
    metadata: LiveMetadata
  ): OperationResult {
    const persisted = this.storage.set(this.key, value);

    if (!persisted) {
      return operationError(
        'operation_failed',
        'Operation could not be persisted'
      );
    }

    this.notifyLiveState(LiveState.value(value as T, metadata));

    if (!existedBefore) {
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

  // TODO: Move persistence of processing effects into a reusable processor.
  private persistDelete(existedBefore: boolean): OperationResult {
    if (!this.storage.delete(this.key)) {
      return operationError(
        'operation_failed',
        'Operation could not be persisted'
      );
    }

    this.notifyLiveState(LiveState.absent('deleted'));

    if (existedBefore) {
      this.options.onKeyMembershipChange?.();
    }

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
