import { Subscriber } from './reactivity/subscriber.js';
import { Subscription } from './reactivity/subscription.js';
import { LiveState, AbsentReason } from './value-state.js';

export interface Live<T> {
  get(): LiveState<T>;
  subscribe(subscriber: Subscriber<LiveState<T>>): Subscription;

  // Actions
  setValue(value: T): void;
  deleteValue(): void;
}

export abstract class BaseLive<T> implements Live<T> {
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

  abstract get(): LiveState<T>;
  abstract setValue(value: T): void;
  abstract deleteValue(): void;
}

/**
 * The reason this is hacky: It's mostly being used for mutations to get
 * the current value of a Live. But if the Live's value isn't loaded, or has
 * an error, the action should handle them somehow. This function just ignores
 * these edge cases and returns undefined
 */
export function HACKY_getCurrentLiveValue<T>(
  live: Live<T>,
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
