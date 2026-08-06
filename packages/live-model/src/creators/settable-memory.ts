import {
  emptyLiveMetadata,
  LiveState,
  type LiveMetadata,
  type LiveState as LiveStateType,
} from '../protocol.js';
import { BaseLive } from '../live.js';
import { Subscriber } from '../reactivity/subscriber.js';
import { Subscription } from '../reactivity/subscription.js';

export class SettableMemoryLive<T> extends BaseLive<T> {
  private state: LiveStateType<T>;
  constructor(initialValue: T, metadata: LiveMetadata = emptyLiveMetadata) {
    super();
    this.state = LiveState.value(initialValue, metadata);
  }

  override subscribe(subscriber: Subscriber<LiveStateType<T>>): Subscription {
    const subscription = super.subscribe(subscriber);
    subscriber.next(this.state);
    return subscription;
  }

  get(): LiveStateType<T> {
    return this.state;
  }

  protected override applySetValueOperation(v: T) {
    const metadata =
      this.state.kind === 'loading'
        ? emptyLiveMetadata
        : this.state.metadata ?? emptyLiveMetadata;
    this.state = LiveState.value(v, metadata);
    this.notifyLiveState(this.state);
  }

  protected override applyDeleteOperation(): void {
    const metadata =
      this.state.kind === 'loading' ? undefined : this.state.metadata;
    this.state = LiveState.absent('deleted', undefined, metadata);
    this.notifyLiveState(this.state);
  }

  protected override applySetMetadataOperation(metadata: LiveMetadata): void {
    if (this.state.kind === 'value') {
      this.state = LiveState.value(this.state.value, metadata);
    } else if (this.state.kind === 'absent') {
      this.state = LiveState.absent(
        this.state.reason,
        this.state.error,
        metadata
      );
    } else {
      this.state = LiveState.absent(undefined, undefined, metadata);
    }
    this.notifyLiveState(this.state);
  }
}
