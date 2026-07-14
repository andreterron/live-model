import { useEffect, useState } from 'react';

const storageKey = 'live-model:explorer:recent-keys';
const changeEvent = 'live-model:explorer:recent-keys-change';
const recentKeyLimit = 8;

function readRecentKeys() {
  if (typeof window === 'undefined') return [];

  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(storageKey) ?? '[]'
    );
    return Array.isArray(value)
      ? value.filter((key): key is string => typeof key === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeRecentKeys(keys: string[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(keys));
  window.dispatchEvent(new Event(changeEvent));
}

export function recordRecentExplorerKey(key: string) {
  if (typeof window === 'undefined') return;

  const keys = readRecentKeys().filter((recentKey) => recentKey !== key);
  writeRecentKeys([key, ...keys].slice(0, recentKeyLimit));
}

export function removeRecentExplorerKey(key: string) {
  if (typeof window === 'undefined') return;
  writeRecentKeys(readRecentKeys().filter((recentKey) => recentKey !== key));
}

export function useRecentExplorerKeys() {
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setKeys(readRecentKeys());
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener(changeEvent, refresh);

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(changeEvent, refresh);
    };
  }, []);

  return keys;
}
