import { allKeysKey } from '@live-model/protocol';
import { useLiveState } from './use-live-state.js';

export function useAllKeys() {
  const { value } = useLiveState<string[]>(allKeysKey, []);
  return value;
}
