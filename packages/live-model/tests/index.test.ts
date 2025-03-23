import { expect, test, vi } from 'vitest';
import { Action, Source } from '../src/index.js';

describe('input and output', () => {
  test('events can be triggered at sources', async () => {
    let action: Action = {};

    let source = new Source();

    source.dispatch(action);
  });

  test('subscribers can receive events', async () => {
    let source = new Source();
    let action: Action = {};
    let notification = vi.fn();
    source.subscribe({ notification });
    source.dispatch(action);
    expect(notification).toHaveBeenCalledWith(action);
  });
});
