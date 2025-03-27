import { useLocalStorage } from 'usehooks-ts';

export type UseDataReturn<T> = {
  value: T;
  set: React.Dispatch<React.SetStateAction<T | undefined>>;
  delete: () => void;
};

export interface UseDataOptions {
  initializeWithValue?: boolean;
}

export function useData<T>(
  key: string,
  defaultValue?: undefined,
  options?: UseDataOptions
): UseDataReturn<T | undefined>;
export function useData<T>(
  key: string,
  defaultValue: T,
  options?: UseDataOptions
): UseDataReturn<T>;
export function useData<T>(
  key: string,
  defaultValue?: T,
  { initializeWithValue = false }: UseDataOptions = {}
): UseDataReturn<T | undefined> {
  // TODO: Read initializeWithValue from Context
  const [value, setValue, removeValue] = useLocalStorage(key, defaultValue, {
    initializeWithValue,
  });
  return { value, set: setValue, delete: removeValue };
}
