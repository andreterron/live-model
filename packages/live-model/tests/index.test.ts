// import { expect, test, jest } from "@jest/globals";
import { expect, test, vi } from 'vitest';
import { Action, Source } from '../src/lib/index.js';

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

// describe('interface', () => {
//   // As close as possible to a native object. Or native React.
//   // This will likely be a monorepo. But right now, it's a playground.
//   // We'll likely have multiple different interfaces: Core, Proxy, React, etc.
//   // Probably good to start with one interface I want to use today.
// });
