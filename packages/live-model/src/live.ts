export interface Live<T> {
  get(): T;

  // Actions
  setValue(value: T): void;
}
