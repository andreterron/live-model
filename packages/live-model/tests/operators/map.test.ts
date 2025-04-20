import { map, value } from '../../src/index.js';

describe('operator map', () => {
  let source = value(1);

  test('returns a transformed value', async () => {
    // Setup
    const transform = vitest.fn((v) => v + 1);
    const live = map(source, transform);

    // Test
    const value = live.get();

    // Verify
    expect(value).toBe(2);
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
});
