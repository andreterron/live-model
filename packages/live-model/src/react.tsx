import { useLocalStorage } from 'usehooks-ts';

export interface UseLiveStateOptions {
  initializeWithValue?: boolean;
}

export function useLiveState(
  key: string,
  options?: UseLiveStateOptions
): {
  value: any;
  setValue: React.Dispatch<React.SetStateAction<any>>;
};
export function useLiveState<T>(
  key: string,
  options?: UseLiveStateOptions
): {
  value: T | undefined;
  setValue: React.Dispatch<React.SetStateAction<T | undefined>>;
};
export function useLiveState<T>(
  key: string,
  defaultValue: T,
  options?: UseLiveStateOptions
): { value: T; setValue: React.Dispatch<React.SetStateAction<T | undefined>> };
export function useLiveState<T = unknown>(
  key: string,
  defaultValue?: T,
  options?: UseLiveStateOptions
): {
  value: T | undefined;
  setValue: React.Dispatch<React.SetStateAction<T | undefined>>;
} {
  const [value, setValue] = useLocalStorage(key, defaultValue, options);

  return {
    value,
    setValue,
  };
}
