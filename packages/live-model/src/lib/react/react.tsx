import { useLocalStorage } from 'usehooks-ts';

export type UseDataReturn<T> = {
  value: T;
  set: React.Dispatch<React.SetStateAction<T | undefined>>;
  delete: () => void;
};

export function useData<T>(key: string): UseDataReturn<T | undefined>;
export function useData<T>(key: string, defaultValue: T): UseDataReturn<T>;
export function useData<T>(
  key: string,
  defaultValue?: T
): UseDataReturn<T | undefined> {
  const [value, setValue, removeValue] = useLocalStorage(key, defaultValue, {
    initializeWithValue: typeof window !== 'undefined',
  });
  return { value, set: setValue, delete: removeValue };
}
