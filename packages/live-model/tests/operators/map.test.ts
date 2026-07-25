import {
  type Live,
  mapState,
  mapValue,
  SettableMemoryLive,
  valueTransform,
} from '../../src/index.js';

describe('operator mapValue', () => {
  let source: SettableMemoryLive<number>;

  beforeEach(() => {
    source = new SettableMemoryLive(1);
  });

  test('returns a transformed value', async () => {
    // Setup
    const transform = vitest.fn((v) => v + 1);
    const live = mapValue(source, transform);

    // Test
    const value = live.get();

    // Verify
    expect(value).toMatchObject({ kind: 'value', value: 2 });
    expect(transform).toHaveBeenCalledOnce();
  });

  test('can define a setter', async () => {
    // Setup
    const transform = vitest.fn((v) => v + 1);
    const setValue = vitest.fn((input: Live<number>, value: number) => {
      void input;
      void value;
    });
    const live = mapValue(source, transform, {
      set_value: setValue,
    });

    // Test
    live.op('set_value', 2);

    // Verify
    expect(setValue).toHaveBeenCalledWith(source, 2);
  });

  test('notifies subscribers with transformed live state values', () => {
    // Setup
    const transform = vitest.fn((v) => v + 1);
    const live = mapValue(source, transform);
    const next = vitest.fn();
    const sub = live.subscribe({ next });
    next.mockClear();

    // Test
    source.setValue(2);

    // Verify
    expect(next).toHaveBeenCalledExactlyOnceWith({ kind: 'value', value: 3 });

    // Teardown
    sub.unsubscribe();
  });

  test('can define a deleter', () => {
    // Setup
    const transform = vitest.fn((v) => v + 1);
    const deleteValue = vitest.fn((input: Live<number>) => {
      void input;
    });
    const live = mapValue(source, transform, {
      delete: deleteValue,
    });

    // Test
    live.op('delete');

    // Verify
    expect(deleteValue).toHaveBeenCalledWith(source);
  });

  test('infers and dispatches custom operations from a handler map', () => {
    const increment = vitest.fn((input: Live<number>, amount: number) => {
      const state = input.get();
      if (state.kind === 'value') {
        input.setValue(state.value + amount);
      }
    });
    const reset = vitest.fn((input: Live<number>) => {
      input.setValue(0);
    });
    const live = mapValue(source, (value) => value * 2, {
      increment,
      reset,
    });

    const typedLive: Live<
      number,
      {
        increment: { data: number };
        reset: object;
      }
    > = live;
    expect(typedLive).toBe(live);

    expect(live.op({ type: 'increment', data: 2 })).toEqual({
      status: 'success',
    });
    expect(live.get()).toEqual({ kind: 'value', value: 6 });
    expect(increment).toHaveBeenCalledWith(source, 2);

    expect(live.op('reset')).toEqual({ status: 'success' });
    expect(live.get()).toEqual({ kind: 'value', value: 0 });
    expect(reset).toHaveBeenCalledWith(source);
  });

  test('mapState transforms the live state', () => {
    // Setup
    const transform = vitest.fn(() => ({
      kind: 'absent' as const,
      reason: 'not_found' as const,
    }));
    const live = mapState(source, transform);

    // Test
    const value = live.get();

    // Verify
    expect(value).toMatchObject({ kind: 'absent', reason: 'not_found' });
    expect(transform).toHaveBeenCalledExactlyOnceWith({
      kind: 'value',
      value: 1,
    });
  });

  test('valueTransform does not call the transform for non-value states', () => {
    // Setup
    const transform = vitest.fn((v: number) => v + 1);
    const liveStateTransform = valueTransform(transform);

    // Test
    const value = liveStateTransform({ kind: 'absent', reason: 'deleted' });

    // Verify
    expect(value).toMatchObject({ kind: 'absent', reason: 'deleted' });
    expect(transform).not.toHaveBeenCalled();
  });
});
