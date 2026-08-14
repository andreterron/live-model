export interface Propagator<NODE = unknown> {
  enqueue(node: NODE): void;
}
