import { map, SettableMemoryLive } from '../../src/index.js';

describe('operator map', () => {
  let source = new SettableMemoryLive(1);

  test('returns a transformed value', async () => {
    // Setup
    const transform = vitest.fn((v) => v + 1);
    const live = map(source, transform);

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
    const live = map(source, transform, aSetter);

    // Test
    live.setValue(2);

    // Verify
    expect(aSetter).toHaveBeenCalledWith(2, source);
  });

  test('notifies subscribers with transformed live state values', () => {
    // Setup
    const transform = vitest.fn((v) => v + 1);
    const live = map(source, transform);
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
    const live = map(source, transform, undefined, aDeleter);

    // Test
    live.deleteValue();

    // Verify
    expect(aDeleter).toHaveBeenCalledWith(source);
  });
});
