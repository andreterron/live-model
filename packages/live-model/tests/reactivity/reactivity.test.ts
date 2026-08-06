import { SettableMemoryLive } from '../../src/index.js';
import { awaitableFn } from '../test-utils/wait-for-call.js';
import { vi } from 'vitest';

describe('reactivity', () => {
  test('accepts serialized operation objects', () => {
    const live = new SettableMemoryLive(1);

    expect(live.op({ type: 'set_value', data: 2 })).toEqual({
      status: 'success',
    });
    expect(live.get()).toEqual({ kind: 'value', value: 2, metadata: {} });

    expect(live.op({ type: 'delete' })).toEqual({ status: 'success' });
    expect(live.get()).toEqual({
      kind: 'absent',
      reason: 'deleted',
      metadata: {},
    });
  });

  test('subscribers get a callback when the value changes', async () => {
    // Setup
    const live = new SettableMemoryLive(1);
    const next = awaitableFn();
    const sub = live.subscribe({ next });
    await next.waitFor(
      ({ args }) => args[0].kind === 'value' && args[0].value === 1
    );
    next.mockClear();

    // Test
    live.setValue(2);

    // Verify
    await next.waitFor(
      ({ args }) => args[0].kind === 'value' && args[0].value === 2
    );
    expect(next).toHaveBeenCalledExactlyOnceWith({
      kind: 'value',
      value: 2,
      metadata: {},
    });

    // Teardown
    sub.unsubscribe();
  });

  test('subscribers are called synchronously during subscription', () => {
    // Setup
    const live = new SettableMemoryLive(1);
    const next = vi.fn();
    const sub = live.subscribe({ next });
    expect(next).toHaveBeenCalledExactlyOnceWith({
      kind: 'value',
      value: 1,
      metadata: {},
    });
    next.mockClear();

    // Test
    live.setValue(2);

    // Verify
    expect(next).toHaveBeenCalledExactlyOnceWith({
      kind: 'value',
      value: 2,
      metadata: {},
    });

    // Teardown
    sub.unsubscribe();
  });

  test('subscribers get an absent callback when the value is deleted', async () => {
    // Setup
    const live = new SettableMemoryLive(1);
    const next = awaitableFn();
    const sub = live.subscribe({ next });
    await next.waitFor(
      ({ args }) => args[0].kind === 'value' && args[0].value === 1
    );
    next.mockClear();

    // Test
    live.deleteValue();

    // Verify
    await next.waitFor(
      ({ args }) => args[0].kind === 'absent' && args[0].reason === 'deleted'
    );
    expect(next).toHaveBeenCalledExactlyOnceWith({
      kind: 'absent',
      reason: 'deleted',
      metadata: {},
    });

    // Teardown
    sub.unsubscribe();
  });

  test('updates metadata without changing the value', () => {
    const live = new SettableMemoryLive(1);
    const next = vi.fn();
    live.subscribe({ next });
    next.mockClear();

    expect(
      live.op({
        type: 'set_metadata',
        data: { op_set: { root: 'counter@1' } },
      })
    ).toEqual({ status: 'success' });
    expect(live.get()).toEqual({
      kind: 'value',
      value: 1,
      metadata: { op_set: { root: 'counter@1' } },
    });
    expect(next).toHaveBeenCalledExactlyOnceWith(live.get());

    live.setValue(2);
    expect(live.get()).toEqual({
      kind: 'value',
      value: 2,
      metadata: { op_set: { root: 'counter@1' } },
    });
  });
});
