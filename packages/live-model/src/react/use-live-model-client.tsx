import { createContext, type ReactNode, useContext } from 'react';
import {
  defaultLiveModelClient,
  type LiveModelClient,
} from '../live-model-client.js';

const LiveModelClientContext = createContext<LiveModelClient>(
  defaultLiveModelClient
);

export interface LiveModelClientProviderProps {
  client: LiveModelClient;
  children: ReactNode;
}

export function LiveModelClientProvider({
  client,
  children,
}: LiveModelClientProviderProps) {
  return (
    <LiveModelClientContext.Provider value={client}>
      {children}
    </LiveModelClientContext.Provider>
  );
}

export function useLiveModelClient(): LiveModelClient {
  return useContext(LiveModelClientContext);
}
