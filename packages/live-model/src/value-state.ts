export type AbsentReason =
  | 'not_found'
  | 'deleted'
  | 'unauthorized'
  | 'offline'
  | 'error';

export type LiveStateLoading = Readonly<{ kind: 'loading' }>;
export type LiveStateAbsent = Readonly<{
  kind: 'absent';
  reason?: AbsentReason;
  error?: unknown;
}>;
export type LiveStateValue<T> = Readonly<{
  kind: 'value';
  value: T;
  error?: unknown;
}>;

export type LiveState<T> =
  | LiveStateLoading
  | LiveStateAbsent
  | LiveStateValue<T>;

const cachedAbsentStates: Readonly<{
  [k in Exclude<AbsentReason, 'error'> | '_']: LiveStateAbsent;
}> = Object.freeze({
  not_found: { kind: 'absent', reason: 'not_found' },
  deleted: { kind: 'absent', reason: 'deleted' },
  unauthorized: { kind: 'absent', reason: 'unauthorized' },
  offline: { kind: 'absent', reason: 'offline' },
  _: { kind: 'absent' }, // TODO: Review
});

export const LiveState = Object.freeze({
  loading: Object.freeze({ kind: 'loading' }) as LiveStateLoading,
  value<T>(v: T): LiveStateValue<T> {
    return Object.freeze({ kind: 'value', value: v });
  },
  absent(reason?: AbsentReason, error?: unknown): LiveStateAbsent {
    if (!reason) return cachedAbsentStates['_'];
    // TODO: Consider `error` being a separate state. Or splitting `absent` into separate states
    if (reason !== 'error') {
      return cachedAbsentStates[reason];
    }
    return Object.freeze({ kind: 'absent', reason, error });
  },
});
