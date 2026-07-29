import type {
  LiveState,
  Operation,
  OperationArgs,
  OperationForName,
  OperationName,
  OperationResult,
} from '@live-model/protocol';
import { BaseLive, Live, toOperation } from '../live.js';
import { Subscriber } from '../reactivity/subscriber.js';
import { Subscription } from '../reactivity/subscription.js';

export type DerivedOperationHandlers<Input, OPS extends Operation> = {
  [K in OperationName<OPS>]: OperationForName<OPS, K> extends {
    data: infer Data;
  }
    ? (source: Live<Input>, data: Data) => void
    : (source: Live<Input>) => void;
};

export type DerivedOperationHandlerMap = Record<
  string,
  (...args: any[]) => void
>;

export type OperationsFromHandlers<H extends DerivedOperationHandlerMap> = {
  [K in keyof H & string]: Parameters<H[K]> extends [any, infer Data, ...any[]]
    ? { type: K; data: Data }
    : { type: K };
}[keyof H & string];

class MappedLive<
  T,
  Input,
  H extends DerivedOperationHandlerMap
> extends BaseLive<T, OperationsFromHandlers<H>> {
  protected inputSubscription: Subscription | undefined;

  constructor(
    private live: Live<Input>,
    protected transform: (state: LiveState<Input>) => LiveState<T>,
    protected operationHandlers: H
  ) {
    super();
  }

  override get(): LiveState<T> {
    return this.transform(this.live.get());
  }

  override subscribe(subscriber: Subscriber<LiveState<T>>): Subscription {
    const sub = super.subscribe(subscriber);

    if (!this.inputSubscription) {
      this.inputSubscription = this.live.subscribe({
        next: (v) => {
          this.notifyLiveState(this.transform(v));
        },
      });
    } else {
      const state = this.get();
      subscriber.next(state);
    }

    return {
      unsubscribe: () => {
        sub.unsubscribe();
        if (this.subscribers.size === 0) {
          this.inputSubscription?.unsubscribe();
          this.inputSubscription = undefined;
        }
      },
    };
  }

  override op(operation: OperationsFromHandlers<H>): OperationResult;
  override op<K extends OperationName<OperationsFromHandlers<H>>>(
    type: K,
    ...args: OperationArgs<OperationsFromHandlers<H>, K>
  ): OperationResult;
  override op(
    operationOrType:
      | OperationsFromHandlers<H>
      | OperationName<OperationsFromHandlers<H>>,
    ...args: unknown[]
  ): OperationResult {
    const operation = toOperation<OperationsFromHandlers<H>>(
      operationOrType,
      args
    );
    const handler = this.operationHandlers[operation.type];

    if (!handler) {
      return {
        status: 'error',
        error: {
          code: 'unsupported_operation',
          message: `Operation "${operation.type}" is not supported by this derived Live`,
        },
      };
    }

    if ('data' in operation) {
      handler(this.live, operation.data);
    } else {
      handler(this.live);
    }

    return { status: 'success' };
  }
}

export function valueTransform<T, U>(
  transform: (v: T) => U
): (state: LiveState<T>) => LiveState<U> {
  return (state) => {
    if (state.kind !== 'value') {
      return state;
    }
    return { ...state, value: transform(state.value) };
  };
}

export function mapState<T, U, H extends DerivedOperationHandlerMap>(
  live: Live<T>,
  transform: (state: LiveState<T>) => LiveState<U>,
  operationHandlers: H
): Live<U, OperationsFromHandlers<H>>;
export function mapState<T, U>(
  live: Live<T>,
  transform: (state: LiveState<T>) => LiveState<U>
): Live<U, never>;
export function mapState<T, U>(
  live: Live<T>,
  transform: (state: LiveState<T>) => LiveState<U>,
  operationHandlers: DerivedOperationHandlerMap = {}
): any {
  return new MappedLive(live, transform, operationHandlers);
}

export function mapValue<T, U, H extends DerivedOperationHandlerMap>(
  live: Live<T>,
  transform: (v: T) => U,
  operationHandlers: H
): Live<U, OperationsFromHandlers<H>>;
export function mapValue<T, U>(
  live: Live<T>,
  transform: (v: T) => U
): Live<U, never>;
export function mapValue<T, U>(
  live: Live<T>,
  transform: (v: T) => U,
  operationHandlers?: DerivedOperationHandlerMap
): any {
  return mapState(live, valueTransform(transform), operationHandlers ?? {});
}
