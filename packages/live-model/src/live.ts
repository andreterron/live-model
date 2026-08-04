import type {
  AbsentReason,
  LiveState,
  Operation,
  OperationArgs,
  OperationName,
  OperationResult,
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
    this.subscribers.forEach((s) => s.next({ value: v, kind: 'value' }));
  }

  protected notifyAbsence(reason?: AbsentReason) {
    this.subscribers.forEach((s) => s.next({ kind: 'absent', reason }));
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

  abstract get(): LiveState<T>;

  protected applySetValueOperation(value: T): void {
    throw new Error('set_value is not supported by this Live');
  }

  protected applyDeleteOperation(): void {
    throw new Error('delete is not supported by this Live');
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
