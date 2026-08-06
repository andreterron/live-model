import {
  LiveState,
  liveReference,
  parseLiveReference,
  type LiveReference,
  type LiveMetadata,
  type LiveState as LiveStateType,
  type Operation,
  type OperationArgs,
  type OperationName,
  type OperationResult,
} from './protocol.js';
import type { Live } from './live.js';
import { toOperation } from './live.js';
import type { Subscriber } from './reactivity/subscriber.js';
import type { Subscription } from './reactivity/subscription.js';

type LiveFactory = (key: string) => Live<unknown>;

/**
 * Converts materialized JSON references to canonical Lives and back again.
 * Each registry owns one codec so reference identity remains registry-scoped.
 */
export class LiveReferenceCodec {
  private readonly referencesByLive = new WeakMap<
    Live<unknown>,
    LiveReference
  >();

  constructor(private readonly forKey: LiveFactory) {}

  register(key: string, live: Live<unknown>): void {
    this.referencesByLive.set(live, liveReference(key));
  }

  decode(value: unknown): unknown {
    return this.transform(value, 'decode', new WeakSet<object>());
  }

  encode(value: unknown): unknown {
    return this.transform(value, 'encode', new WeakSet<object>());
  }

  private transform(
    value: unknown,
    direction: 'decode' | 'encode',
    ancestors: WeakSet<object>
  ): unknown {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    if (direction === 'encode') {
      const reference = this.referencesByLive.get(value as Live<unknown>);
      if (reference) {
        return reference;
      }

      if (looksLikeLive(value)) {
        throw new Error(
          'Cannot encode a Live that does not belong to this Live registry'
        );
      }
    }

    if (isPlainObject(value)) {
      const target = parseLiveReference(value);
      if (target) {
        if (direction === 'encode') {
          return value;
        }

        if (target.pointer !== undefined && target.pointer !== '') {
          throw new Error(
            'JSON Pointer fragments in Live references are not supported yet'
          );
        }

        return this.forKey(target.key);
      }
    }

    if (!Array.isArray(value) && !isPlainObject(value)) {
      return value;
    }

    if (ancestors.has(value)) {
      throw new Error('Cannot encode or decode a cyclic inline value');
    }

    ancestors.add(value);
    const transformed = Array.isArray(value)
      ? value.map((item) => this.transform(item, direction, ancestors))
      : Object.fromEntries(
          Object.entries(value).map(([key, item]) => [
            key,
            this.transform(item, direction, ancestors),
          ])
        );
    ancestors.delete(value);

    return transformed;
  }
}

/**
 * Presents a resolved consumer value while its source Live continues to own
 * materialized JSON suitable for persistence and transport.
 */
export class ReferenceResolvingLive<T, OPS extends Operation = Operation>
  implements Live<T, OPS>
{
  private lastSourceState?: LiveStateType<unknown>;
  private lastDecodedState?: LiveStateType<T>;

  constructor(
    private readonly source: Live<unknown, Operation>,
    private readonly codec: LiveReferenceCodec
  ) {}

  get(): LiveStateType<T> {
    return this.decodeState(this.source.get());
  }

  subscribe(subscriber: Subscriber<LiveStateType<T>>): Subscription {
    return this.source.subscribe({
      next: (state) => subscriber.next(this.decodeState(state)),
    });
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

    try {
      const materializedOperation =
        'data' in operation
          ? { ...operation, data: this.codec.encode(operation.data) }
          : operation;

      return this.source.op(materializedOperation as Operation);
    } catch (error) {
      return {
        status: 'error',
        error: {
          code: 'invalid_reference',
          message:
            error instanceof Error
              ? error.message
              : 'Operation contains an invalid Live reference',
        },
      };
    }
  }

  setValue(value: T): void {
    this.op({ type: 'set_value', data: value } as OPS);
  }

  deleteValue(): void {
    this.op({ type: 'delete' } as OPS);
  }

  setMetadata(metadata: LiveMetadata): void {
    this.source.setMetadata(metadata);
  }

  private decodeState(state: LiveStateType<unknown>): LiveStateType<T> {
    if (state === this.lastSourceState && this.lastDecodedState) {
      return this.lastDecodedState;
    }

    let decodedState: LiveStateType<T>;

    if (state.kind !== 'value') {
      decodedState = state;
    } else {
      try {
        decodedState = {
          ...state,
          value: this.codec.decode(state.value) as T,
        };
      } catch (error) {
        decodedState = LiveState.absent('error', error, state.metadata);
      }
    }

    this.lastSourceState = state;
    this.lastDecodedState = decodedState;
    return decodedState;
  }
}

function isPlainObject(value: object): value is Record<string, unknown> {
  if (Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function looksLikeLive(value: object): value is Live<unknown> {
  const candidate = value as Partial<Live<unknown>>;
  return (
    typeof candidate.get === 'function' &&
    typeof candidate.subscribe === 'function' &&
    typeof candidate.op === 'function' &&
    typeof candidate.setValue === 'function' &&
    typeof candidate.deleteValue === 'function'
  );
}
