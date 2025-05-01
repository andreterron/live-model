import { EventEmitter, once } from 'stream';
import { vi, Mock } from 'vitest';
import { MockResult } from '@vitest/spy';

type Procedure = (...args: any[]) => any;

// TODO: Improve typing if needed

type EmitterMockEventMap = {
  call: [{ args: any[] }];
  return: [{ args: any[]; result: any }];
  result: [{ args: any[]; result: any }];
  error: [{ args: any[]; error: any }];
};

type EmitterMock<T extends Procedure = Procedure> = Mock<T> & {
  emitter: EventEmitter<EmitterMockEventMap>;
  waitFor: (
    filter?: (call: { args: any[]; result: MockResult<any> }) => boolean,
    options?: Parameters<typeof once>[2] & WaitForOptions
  ) => Promise<void>;
};

interface WaitForOptions {
  eventName?: keyof EmitterMockEventMap;
  timeoutMs?: number;
}

// TODO: This only is useful if we can look at previous calls as well
export function awaitableFn<T extends Procedure = Procedure>(
  implementation?: T
): EmitterMock<T> {
  const emitter = new EventEmitter<EmitterMockEventMap>();

  const fn = vi.fn<T>(((...args: Parameters<T>) => {
    emitter.emit('call', { args });
    try {
      const result = implementation?.(...args);
      emitter.emit('return', { args, result });
      if (result instanceof Promise) {
        result.then(
          (v) => emitter.emit('result', { args, result: v }),
          (error) => emitter.emit('error', { args, error })
        );
      } else {
        emitter.emit('result', { args, result });
      }
      return result;
    } catch (error) {
      emitter.emit('error', { args, error });
      throw error;
    }
  }) as any);

  const fn2: EmitterMock<T> = Object.assign(fn, {
    emitter,
    waitFor: (
      filter?: (call: { args: any[]; result: MockResult<any> }) => boolean,
      options?: Parameters<typeof once>[2] & WaitForOptions
    ) => {
      if (filter) {
        for (let i = 0; i < fn.mock.calls.length; i++) {
          const args = fn.mock.calls[i];
          const result = fn.mock.results[i];
          if (filter({ args, result })) {
            return Promise.resolve();
          }
        }
      }

      const timeoutMs = options?.timeoutMs ?? 5000;
      const controller = new AbortController();
      const eventName = options?.eventName ?? 'result';
      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          controller.abort();
        });
      }
      const t = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      return once(emitter, eventName, { signal: controller.signal })
        .then(() => {})
        .finally(() => {
          clearTimeout(t);
        });
    },
  });

  return fn2;
}
