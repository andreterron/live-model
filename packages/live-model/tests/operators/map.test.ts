import {
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
    const aSetter = vitest.fn();
    const live = mapValue(source, transform, aSetter);

    // Test
    live.setValue(2);

    // Verify
    expect(aSetter).toHaveBeenCalledWith(2, source);
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
    const aDeleter = vitest.fn();
    const live = mapValue(source, transform, undefined, aDeleter);

    // Test
    live.deleteValue();

    // Verify
    expect(aDeleter).toHaveBeenCalledWith(source);
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
