import { useEffect, useState } from 'react';

function getLocalStorageKeys() {
  return Array.from({ length: localStorage.length }, (_, index) =>
    localStorage.key(index)
  )
    .filter((key): key is string => key !== null)
    .sort((a, b) => a.localeCompare(b));
}

export function useLocalStorageKeys() {
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    const refreshKeys = () => setKeys(getLocalStorageKeys());

    refreshKeys();
    window.addEventListener('storage', refreshKeys);
    window.addEventListener('local-storage', refreshKeys);

    return () => {
      window.removeEventListener('storage', refreshKeys);
      window.removeEventListener('local-storage', refreshKeys);
    };
  }, []);

  return keys;
}
