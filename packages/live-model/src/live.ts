export interface Live<T> {
  get(): T | undefined;

  // Actions
  setValue(value: T): void;
}
