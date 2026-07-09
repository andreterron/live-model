/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import {
  defaultLiveModelClient,
  LiveModelClient,
  LiveModelClientProvider,
  useLiveModelClient,
  WebSocketTransport,
} from '../../src/index.js';

describe('react useLiveModelClient', () => {
  test('returns the default client outside of a provider', () => {
    const { result } = renderHook(() => useLiveModelClient());

    expect(result.current).toBe(defaultLiveModelClient);
  });

  test('returns a provider client when one is available', () => {
    const client = new LiveModelClient({
      transport: new WebSocketTransport('ws://live-model.test'),
    });

    const { result } = renderHook(() => useLiveModelClient(), {
      wrapper: ({ children }) => (
        <LiveModelClientProvider client={client}>
          {children}
        </LiveModelClientProvider>
      ),
    });

    expect(result.current).toBe(client);
  });
});
