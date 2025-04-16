import { useLocalStorage } from 'usehooks-ts';
import { Live, LocalStorageLive } from './live.js';
import { useEffect, useMemo, useRef, useState } from 'react';

export type UseDataReturn<T> = {
  value: T;
  // TODO: Move away from `any`. Ensure `set` only accepts storage parameters, no calculated properties or actions (model stuff)
  set: React.Dispatch<React.SetStateAction<any>>;
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

// TODO: Get this option from a context
export interface UseLiveOptions<T> {
  /**
   * Used for non-ssr environments.
   * @experimental Not yet implemented
   */
  // initializeWithValue?: boolean,

  /**
   * Value used on the first render. Useful for SSR.
   */
  initialValue?: T;
}

// NOTE: This can't exist. Calling setValue during render causes React issues
// export function useLiveValue<T>(value: T): Live<T> {
//   const liveRef = useRef<Live<T> | undefined>(undefined);

//   const live = useMemo(() => {
//     if (!liveRef.current) {
//       liveRef.current = new Live<T>(value, {});
//     } else {
//       // TODO: This may trigger a value updating elsewhere, which would likely
//       //       call setState, which triggers a react error.
//       liveRef.current.setValue(value);
//     }
//     return liveRef.current;
//   }, [value]);

//   return live;
// }

export function useLivePipeline<T, U>(
  live: Live<T>,
  callback: (v$: Live<T>) => Live<U>
): Live<U> {
  // TODO
  return callback(live);
}

export function useLiveState(key: string): { value: any; live: Live<any> };
export function useLiveState<T>(key: string): {
  value: T | undefined;
  live: Live<T | undefined>;
};
export function useLiveState<T>(
  key: string,
  defaultValue: T
): { value: T; live: Live<T> };
export function useLiveState<T = unknown>(
  key: string,
  defaultValue?: T
): { value: T | undefined; live: Live<T | undefined> } {
  // const liveKey = useLiveValue(key);

  // The derivation needs to run exactly once, and memoized. So it needs some kind of function
  // 1. useSomeHook(() => liveKey.derive(key => new LocalStorageLive(key)))
  // 2. useAnotherHook(liveKey, key => new LocalStorageLive(key))
  // 3. useAnotherHook([liveKey], key => new LocalStorageLive(key))

  // TODO: Validation?
  const live = useMemo(() => {
    const raw = new LocalStorageLive(key);
    if (defaultValue !== undefined) {
      // TODO: passthrough actions. passthrough values. if localStorage
      //       doesn't have the value, stop the propagation, and set the value
      //       to the underlying Live.
      // NOTE: This might be much easier to implement inside the LocalStorageLive
      // return new Live()
      // return Live.derived()
    }
    return raw;
  }, [key]);

  // const live = liveKey.
  // const live = useLivePipeline(
  //   liveKey,
  //   // TODO: flatMap doesn't exist. Figure out the interface you want for it.
  //   flatMap((key: string) => new LocalStorageLive(key))
  // );
  // const live = useMemo(() => liveKey.flatMap((key: string) => new LocalStorageLive(key)), [])
  // const live = useMemo(() => liveKey.flatMap((key: string) => new LocalStorageLive(key)), [])
  // const live = useMemo(() => {}, [key]);

  // TODO: Persist the value using the key
  return {
    value: defaultValue,
    // TODO: set
    live,
  };
}

// Is this function ever needed?
// export function useDerivedLive(source: any, transform: () => any) {}

// TODO: This shouldn't wait a frame if the app is already hydrated. We might need a global context
//       To store that state for the whole app.
export function useLive<T>(
  live: Live<T | undefined>,
  options?: UseLiveOptions<T>
): UseDataReturn<T | undefined> {
  const [valueState, setValue] = useState<T | undefined>(options?.initialValue);

  useEffect(() => {
    const sub = live.subscribe({
      notification(action) {
        setValue(action);
      },
    });
    return () => {
      sub.unsubscribe();
    };
  }, [live]);

  return {
    // TODO: Return the live ID
    // id: live.id
    value: valueState,
    set: (v) => {
      live.setValue(v);
    },
    delete: () => {
      live.setValue(undefined);
    },
  };
}

// --------------------------
// Non-SSR support below
// --------------------------

// TODO: initializeWithValue should (probably) be on the `live` itself. Or as a subscribe option somehow.
// TODO: Read initializeWithValue from Context
// export function useLive<T>(
//   live: Live<T>,
//   options?: UseLiveOptions<T>
// ): UseDataReturn<T | undefined> {
//   const valueRef = useRef<T>(undefined);

//   // TODO: Use a Symbol instead of undefined
//   const [valueState, setValue] = useState<T | undefined>(undefined);
//   const subscription = useMemo(() => {
//     return live.subscribe({
//       notification(action) {
//         // TODO: Set to current value
//         if (valueRef.current) {
//           setValue(action);
//         }
//         valueRef.current = action;
//       },
//     });
//   }, []);

//   // We don't set valueState on the first render
//   const value = valueState ?? valueRef.current;

//   useEffect(() => {
//     return () => {
//       subscription.unsubscribe();
//     };
//   }, [subscription]);

//   return {
//     value,
//     set: setValue,
//     delete: () => {
//       setValue(undefined);
//     },
//   };
// }
