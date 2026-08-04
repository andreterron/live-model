import { LiveState } from '../../src/protocol.js';

describe('LiveState', () => {
  test('loading state is immutable', () => {
    expect(Object.isFrozen(LiveState)).toBe(true);
    expect(Object.isFrozen(LiveState.loading)).toBe(true);

    expect(() => {
      (LiveState as { loading: unknown }).loading = { kind: 'value', value: 1 };
    }).toThrow(TypeError);

    expect(() => {
      (LiveState.loading as { kind: string }).kind = 'something else';
    }).toThrow(TypeError);
  });
});
