import { SettableMemoryLive } from '../../src/index.js';
import { awaitableFn } from '../test-utils/wait-for-call.js';

describe('reactivity', () => {
  test('subscribers get a callback when the value changes', async () => {
    // Setup
    const live = new SettableMemoryLive(1);
    const next = awaitableFn();
    const sub = live.subscribe({ next });
    await next.waitFor(({ args }) => args[0] === 1);
    next.mockClear();

    // Test
    live.setValue(2);

    // Verify
    await next.waitFor(({ args }) => args[0] === 2);
    expect(next).toHaveBeenCalledExactlyOnceWith(2);

    // Teardown
    sub.unsubscribe();
  });
});
