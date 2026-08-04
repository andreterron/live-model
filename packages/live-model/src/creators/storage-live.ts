import {
  LiveState,
  type DefaultOperations,
  type Operation,
  type OperationArgs,
  type OperationError,
  type OperationName,
  type OperationResult,
} from '../protocol.js';
import { BaseLive, toOperation } from '../live.js';
import type { Subscriber } from '../reactivity/subscriber.js';
import type { Subscription } from '../reactivity/subscription.js';

export interface StorageAdapter {
  get(key: string): LiveState<unknown>;
  listKeys(): string[];
  set(key: string, data: unknown): boolean;
  delete(key: string): boolean;
}

export interface StorageLiveOptions<OPS extends Operation = Operation> {
  onKeyMembershipChange?(): void;
  operationHandlers?: StorageOperationHandlers<OPS>;
}

// TODO: Replace storage-specific operation handlers with a general solution

export type StorageOperationHandlerResult =
  | { status: 'success'; action: 'set'; value: unknown }
  | { status: 'success'; action: 'delete' }
  | { status: 'error'; error: OperationError };

export type StorageOperationHandler<OPS extends Operation = Operation> = (
  currentState: LiveState<unknown>,
  operation: OPS
) => StorageOperationHandlerResult;

export type StorageOperationHandlers<OPS extends Operation = Operation> =
  Record<string, StorageOperationHandler<OPS>>;

export const defaultStorageOperationHandlers: StorageOperationHandlers = {
  set_value(_currentState, operation) {
    if (!('data' in operation)) {
      return operationError('invalid_operation', 'set_value requires data');
    }

    return {
      status: 'success',
      action: 'set',
      value: operation.data,
    };
  },
  delete() {
    return {
      status: 'success',
      action: 'delete',
    };
  },
};

/** A synchronous Live whose value is owned by a key-value storage adapter. */
export class StorageLive<
  T,
  OPS extends Operation = DefaultOperations<T>
> extends BaseLive<T, OPS> {
  private readonly operationHandlers: StorageOperationHandlers<OPS>;

  constructor(
    private readonly key: string,
    private readonly storage: StorageAdapter,
    private readonly options: StorageLiveOptions<OPS> = {}
  ) {
    super();
    this.operationHandlers =
      options.operationHandlers ?? defaultStorageOperationHandlers;
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

    const handler = this.operationHandlers[operation.type];
    if (!handler) {
      return operationError(
        'unsupported_operation',
        `Operation "${operation.type}" is not supported by this Live`
      );
    }

    const result = handler(currentState, operation);
    if (result.status === 'error') {
      return result;
    }

    if (result.action === 'delete') {
      return this.persistDelete(existedBefore);
    }

    return this.persistValue(result.value, existedBefore);
  }

  // TODO: Remove persistValue. Logic should be on the operationHandler itself.
  private persistValue(
    value: unknown,
    existedBefore: boolean
  ): OperationResult {
    const persisted = this.storage.set(this.key, value);

    if (!persisted) {
      return operationError(
        'operation_failed',
        'Operation could not be persisted'
      );
    }

    this.notifyLiveState(LiveState.value(value as T));

    if (!existedBefore) {
      this.options.onKeyMembershipChange?.();
    }

    return { status: 'success' };
  }

  // TODO: Remove persistDelete. Logic should be on the operationHandler itself.
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
