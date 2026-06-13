export type AbsentReason =
  | 'not_found'
  | 'deleted'
  | 'unauthorized'
  | 'offline'
  | 'error';

export type LiveState<T> =
  | { kind: 'loading'; since: Date }
  | { kind: 'absent'; reason?: AbsentReason; error?: unknown }
  | { kind: 'value'; value: T; error?: unknown };
