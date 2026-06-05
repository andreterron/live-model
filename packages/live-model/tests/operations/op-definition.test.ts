import { live2 } from '../../src/index.js';
import { vi } from 'vitest';

describe('operation definition', () => {
  test('create a live that accepts a certain operation', async () => {
    const handler = vi.fn((prev: number, arg: number): number => prev + arg);

    // const live = Live.value(0, {
    // })
    const live = live2(0, {
      // TODO: Handle a specific event
      increment: handler,
    });

    // TODO: Dispatch an event
    // live.dispatch({ id: 'increment', arg: 1 });
    live.dispatch?.('increment', 1);
    // live.increment(1)

    // Verify that the event was handled
    expect(handler).toHaveBeenCalledWith(0, 1, expect.any(Object));
  });
  test('handlers with no args don`t require the args parameter', async () => {
    const handler = vi.fn((prev: number): number => prev + 1);

    // const live = Live.value(0, {
    // })
    const live = live2(0, {
      // TODO: Handle a specific event
      increment: handler,
    });

    // TODO: Dispatch an event
    // live.dispatch({ id: 'increment', arg: 1 });
    live.dispatch?.('increment');
    // live.increment(1)

    // Verify that the event was handled
    expect(handler).toHaveBeenCalledWith(0, undefined, expect.any(Object));
  });

  // Q: Subscribe to events and not values?
  // Q: when I get an event, do I actively call to update the value?
});
