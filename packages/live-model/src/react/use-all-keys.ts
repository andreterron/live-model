import { allKeysKey } from '../protocol.js';
import { useLiveState } from './use-live-state.js';

export function useAllKeys() {
  const { value } = useLiveState<string[]>(allKeysKey, []);
  return value;
}
