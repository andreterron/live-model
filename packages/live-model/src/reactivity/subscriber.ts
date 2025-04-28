export interface Subscriber<T> {
  next(v: T): void;
}
