import type {
  AbsentReason,
  LiveMetadata,
  LiveState,
  Operation,
  OperationArgs,
  OperationName,
  OperationResult,
} from './protocol.js';
import {
  emptyLiveMetadata,
  LiveState as LiveStateFactory,
  liveMetadataSchema,
} from './protocol.js';
import { Subscriber } from './reactivity/subscriber.js';
import { Subscription } from './reactivity/subscription.js';

export interface Live<T, OPS extends Operation = Operation> {
  get(): LiveState<T>;
  subscribe(subscriber: Subscriber<LiveState<T>>): Subscription;

  // Actions

  // TODO: `op()` can't always synchronously return a result
  op(operation: OPS): OperationResult;
  op<K extends OperationName<OPS>>(
    type: K,
    ...args: OperationArgs<OPS, K>
  ): OperationResult;
  setValue(value: T): void;
  deleteValue(): void;
  setMetadata(metadata: LiveMetadata): void;
}

export abstract class BaseLive<T, OPS extends Operation = Operation>
  implements Live<T, OPS>
{
  protected subscribers = new Set<Subscriber<LiveState<T>>>();

  subscribe(subscriber: Subscriber<LiveState<T>>): Subscription {
    this.subscribers.add(subscriber);

    return {
      unsubscribe: () => {
        this.subscribers.delete(subscriber);
      },
    };
  }

  protected notifySubscribers(v: T) {
    const currentState = this.get();
    const metadata =
      currentState.kind === 'loading'
        ? emptyLiveMetadata
        : currentState.metadata ?? emptyLiveMetadata;
    this.notifyLiveState({ value: v, kind: 'value', metadata });
  }

  protected notifyAbsence(reason?: AbsentReason) {
    const currentState = this.get();
    const metadata =
      currentState.kind === 'loading' ? undefined : currentState.metadata;
    this.notifyLiveState(LiveStateFactory.absent(reason, undefined, metadata));
  }

  protected notifyLiveState(liveState: LiveState<T>) {
    // TODO: liveState shouldn't be mutable. Either create copies or make it readonly
    this.subscribers.forEach((s) => s.next(liveState));
  }

  op(operation: OPS): OperationResult;
  op<K extends OperationName<OPS>>(
    type: K,
    ...args: OperationArgs<OPS, K>
  ): OperationResult;
  op(
    operationOrType: OPS | OperationName<OPS>,
    ...args: unknown[]
  ): OperationResult {
    const operation = toOperation<OPS>(operationOrType, args);

    if (operation.type === 'delete') {
      this.applyDeleteOperation();
      return { status: 'success' };
    }

    if (operation.type === 'set_value') {
      this.applySetValueOperation(
        ('data' in operation ? operation.data : undefined) as T
      );
      return { status: 'success' };
    }

    if (operation.type === 'set_metadata') {
      const parsed = liveMetadataSchema.safeParse(
        'data' in operation ? operation.data : undefined
      );
      if (!parsed.success) {
        return {
          status: 'error',
          error: {
            code: 'invalid_operation',
            message: 'set_metadata requires valid Live metadata',
            details: parsed.error.flatten(),
          },
        };
      }

      this.applySetMetadataOperation(parsed.data);
      return { status: 'success' };
    }

    return {
      status: 'error',
      error: {
        code: 'unsupported_operation',
        message: `Operation "${operation.type}" is not supported by this Live`,
      },
    };
  }

  setValue(value: T): void {
    this.op({ type: 'set_value', data: value } as OPS);
  }

  deleteValue(): void {
    this.op({ type: 'delete' } as OPS);
  }

  setMetadata(metadata: LiveMetadata): void {
    this.op({ type: 'set_metadata', data: metadata } as OPS);
  }

  abstract get(): LiveState<T>;

  protected applySetValueOperation(value: T): void {
    throw new Error('set_value is not supported by this Live');
  }

  protected applyDeleteOperation(): void {
    throw new Error('delete is not supported by this Live');
  }

  protected applySetMetadataOperation(_metadata: LiveMetadata): void {
    throw new Error('set_metadata is not supported by this Live');
  }
}

export function toOperation<OPS extends Operation>(
  operationOrType: OPS | OperationName<OPS>,
  args: readonly unknown[]
): OPS {
  if (typeof operationOrType === 'object') {
    return operationOrType;
  }

  return (
    args.length === 0
      ? { type: operationOrType }
      : { type: operationOrType, data: args[0] }
  ) as OPS;
}

/**
 * The reason this is hacky: It's mostly being used for mutations to get
 * the current value of a Live. But if the Live's value isn't loaded, or has
 * an error, the action should handle them somehow. This function just ignores
 * these edge cases and returns undefined
 */
export function HACKY_getCurrentLiveValue<T>(
  live: Pick<Live<T>, 'get'>,
  operationName?: string
): T | undefined {
  // TODO: Refactor the codebase to delete this whole function
  const state = live.get();
  // NOTE: We're already having to do special treatment for some absence `reason`s
  if (
    state.kind === 'absent' &&
    (state.reason === 'not_found' || state.reason === 'deleted')
  ) {
    return undefined;
  }
  if (state.kind !== 'value') {
    if (operationName) {
      const stateString =
        state.kind === 'absent' ? `absent/${state.reason}` : state.kind;
      console.error(
        `[LiveModel] Execution operation "${operationName}" on invalid state/reason: ${stateString}`
      );
    }
    return undefined;
  }
  return state.value;
}
