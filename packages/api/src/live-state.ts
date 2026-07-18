import {
  allKeysKey,
  type LiveStateLike,
  type StateMessage,
} from '@live-model/protocol';
import type { StorageAdapter } from './storage-adapter/storage-adapter.js';

export function getStateMessageForKey(
  key: string,
  storage: StorageAdapter
): StateMessage {
  return {
    type: 'state',
    key,
    state: getLiveState(storage, key),
  };
}

function getLiveState(storage: StorageAdapter, key: string): LiveStateLike {
  if (key === allKeysKey) {
    return {
      kind: 'value',
      value: storage.listKeys().filter((storedKey) => storedKey !== allKeysKey),
    };
  }

  return storage.get(key);
}
