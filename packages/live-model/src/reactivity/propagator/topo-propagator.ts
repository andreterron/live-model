import { Propagator } from './propagator.js';

enum NodeMark {
  temp,
  permanent,
}

/**
 * Uses topological sorting to choose execution order.
 *
 * Pseudo-code from Wikipedia:
 *
 * L ← Empty list that will contain the sorted nodes
 * while exists nodes without a permanent mark do
 *     select an unmarked node n
 *     visit(n)
 *
 * function visit(node n)
 *     if n has a permanent mark then
 *         return
 *     if n has a temporary mark then
 *         stop   (graph has at least one cycle)
 *
 *     mark n with a temporary mark
 *
 *     for each node m with an edge from n to m do
 *         visit(m)
 *
 *     mark n with a permanent mark
 *     add n to head of L
 */
export abstract class TopoPropagator<NODE = unknown>
  implements Propagator<NODE>
{
  protected queue: Array<NODE> = [];

  // TODO: re-sort if dependencies change mid-propagation

  // Queue Sorting Variables
  protected marks = new Map<NODE, NodeMark>();

  enqueue(node: NODE) {
    this.visit(node);
  }

  /**
   * This is kept as a separate function to support sorting the existing queue if deps change mid-propagation
   */
  protected visit(node: NODE) {
    // TODO: keep nodes sorted between propagations? update the queue as dependencies change?
    // TODO: Stepped Topo Sort?
    switch (this.marks.get(node)) {
      case NodeMark.permanent:
        return;
      case NodeMark.temp:
        throw new Error('Cycle found');
      default:
        break;
    }

    this.marks.set(node, NodeMark.temp);

    // TODO: Avoid recursion
    this.getDependedBy(node).forEach((n) => this.visit(n));

    this.marks.set(node, NodeMark.permanent);
    this.queue.unshift(node);
  }

  protected next() {
    let node = this.queue.shift();
    if (!node) return;

    this.performWork(node);

    this.checkPropagationFinished();
  }

  protected startPropagation() {
    // TODO
  }

  protected checkPropagationFinished() {
    if (this.queue.length !== 0) {
      return;
    }
    this.marks.clear();
  }

  // MARK: Customizable

  protected abstract getValue(node: NODE): any;
  protected abstract getDependedBy(node: NODE): NODE[];
  protected abstract getDepedenciesOf(node: NODE): NODE[];
  // TODO: Async optional?
  protected abstract performWork(node: NODE): void;
}
