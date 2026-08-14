import { LiveState, liveStateSchema } from '../../src/protocol.js';

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

  test('value metadata is required in memory and defaulted on legacy messages', () => {
    expect(LiveState.value(1)).toEqual({
      kind: 'value',
      value: 1,
      metadata: {},
    });
    expect(liveStateSchema.parse({ kind: 'value', value: 1 })).toEqual({
      kind: 'value',
      value: 1,
      metadata: {},
    });
    expect(LiveState.loading).not.toHaveProperty('metadata');
  });

  test('absent metadata remains optional', () => {
    expect(LiveState.absent('not_found')).not.toHaveProperty('metadata');
    expect(
      LiveState.absent('deleted', undefined, {
        op_set: { root: 'counter' },
      })
    ).toEqual({
      kind: 'absent',
      reason: 'deleted',
      metadata: { op_set: { root: 'counter' } },
    });
  });

  test('property operation-set assignments are not accepted yet', () => {
    expect(
      liveStateSchema.safeParse({
        kind: 'value',
        value: { title: 'Draft' },
        metadata: {
          op_set: {
            root: 'todo',
            props: { title: 'text' },
          },
        },
      }).success
    ).toBe(false);
  });
});
