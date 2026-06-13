import { LiveDeleter } from '../deleter.js';
import { BaseLive, Live } from '../live.js';
import { LiveState } from '../value-state.js';
import { Subscriber } from '../reactivity/subscriber.js';
import { Subscription } from '../reactivity/subscription.js';
import { LiveSetter } from '../setter.js';

class MappedLive<T, Input> extends BaseLive<T> {
  protected inputSubscription: Subscription | undefined;

  constructor(
    private live: Live<Input>,
    protected transform: (v: Input) => T,
    protected setter?: LiveSetter<Input, T>,
    protected deleter?: LiveDeleter<Input>
  ) {
    super();
  }

  override get(): LiveState<T> {
    const srcState = this.live.get();
    if (srcState.kind !== 'value') {
      return srcState;
    }
    return { kind: 'value', value: this.transform(srcState.value) };
  }

  override subscribe(subscriber: Subscriber<LiveState<T>>): Subscription {
    const sub = super.subscribe(subscriber);

    if (!this.inputSubscription) {
      this.inputSubscription = this.live.subscribe({
        next: (v) => {
          if (v.kind === 'value') {
            this.notifyLiveState({
              kind: 'value',
              value: this.transform(v.value),
              error: v.error,
            });
          } else {
            this.notifyLiveState(v);
          }
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

  override setValue(value: T): void {
    if (!this.setter) {
      // no-op
      return;
    }

    this.setter(value, this.live);
  }

  override deleteValue(): void {
    if (!this.deleter) {
      // no-op
      return;
    }

    this.deleter(this.live);
  }
}

export function map<T, U>(
  live: Live<T>,
  transform: (v: T) => U,
  setter?: LiveSetter<T, U>,
  deleter?: LiveDeleter<T>
): Live<U> {
  return new MappedLive(live, transform, setter, deleter);
}
