import { deleter, setter, SettableMemoryLive } from '../src/index.js';

describe('operation handler helpers', () => {
  test('creates a passthrough set_value handler', () => {
    const source = new SettableMemoryLive(1);

    setter.passthrough<number>()(source, 2);

    expect(source.get()).toEqual({ kind: 'value', value: 2 });
  });

  test('creates a transforming set_value handler', () => {
    const source = new SettableMemoryLive(1);

    setter.transform<number, string>(Number)(source, '2');

    expect(source.get()).toEqual({ kind: 'value', value: 2 });
  });

  test('preserves a custom source-first set_value handler', () => {
    const source = new SettableMemoryLive(1);
    const handler = vitest.fn();

    setter.handler<number, number>(handler)(source, 2);

    expect(handler).toHaveBeenCalledWith(source, 2);
  });

  test('creates a passthrough delete handler', () => {
    const source = new SettableMemoryLive(1);

    deleter.passthrough<number>()(source);

    expect(source.get()).toEqual({
      kind: 'absent',
      reason: 'deleted',
    });
  });

  test('preserves a custom delete handler', () => {
    const source = new SettableMemoryLive(1);
    const handler = vitest.fn();

    deleter.handler<number>(handler)(source);

    expect(handler).toHaveBeenCalledWith(source);
  });
});
