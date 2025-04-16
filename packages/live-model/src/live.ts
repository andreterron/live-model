import { Source, Subscriber, Subscription } from './propagation.js';

export class Live<T = any, A = any, OPT extends {} = {}> extends Source {
  // TODO: Not all lives should have a stored value
  get value(): T {
    return this._value;
  }

  constructor(protected _value: T, public actions: A) {
    super();
  }

  override subscribe(subscriber: Subscriber, options?: OPT): Subscription {
    const sub = super.subscribe(subscriber);
    subscriber.notification(this._value);
    return sub;
  }

  // TODO: This should be an action, not a random function
  setValue(v: T) {
    this._value = v;
    // Notify subscribers
    this.dispatch(v);
  }
}

export interface LocalStorageLiveOptions {
  initializeWithValue?: boolean;
}

// TODO: initializeWithValue is a React problem, we shouldn't pollute this. Maybe a function/wrapper, or a `useLive` option itself.

// TODO: Remove T | undefined
// TODO: Actions
export class LocalStorageLive<T = any> extends Live<
  T | undefined,
  {},
  LocalStorageLiveOptions
> {
  // TODO: Error emitter

  // TODO: Key
  // TODO: Read value, but only at the right time

  // TODO: Remove readonly? Make it be another live?
  constructor(readonly key: string) {
    super(undefined, {});
  }

  private readValue() {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const item = localStorage.getItem(this.key);
    if (item !== null) {
      try {
        // TODO: Validation? Versioning?
        this._value = JSON.parse(item) as T;
      } catch (e) {
        // TODO: Emit error
        console.error(e);
      }
    }
  }

  override subscribe(
    subscriber: Subscriber,
    options?: Partial<LocalStorageLiveOptions>
  ): Subscription {
    if (options?.initializeWithValue !== false) {
      this.readValue();
    } else {
      setTimeout(() => {
        this.readValue();
        this.dispatch(this._value);
      }, 0);
    }
    return super.subscribe(subscriber);
  }

  // TODO: This should be an action, not a random function
  override setValue(v: T) {
    if (typeof localStorage === 'undefined') {
      return;
    }
    // TODO: Save to localStorage
    localStorage.setItem(this.key, JSON.stringify(v));
    super.setValue(v);
  }
}

export type LiveValue<T extends Live> = T extends Live<infer U> ? U : never;
export type LiveOptions<T extends Live> = T extends Live<any, any, infer U>
  ? U
  : never;
