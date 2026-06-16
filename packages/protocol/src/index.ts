import { z } from 'zod';

// TODO: The zod schemas and interfaces aren't linked. Parsing with the
// schema should yield the right types. Tricky because of generics.
// Maybe remove generics from Messages
// TODO: Update to zod 4

export const liveStateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('loading'),
  }),
  z.object({
    kind: z.literal('absent'),
    reason: z
      .union([
        z.literal('not_found'),
        z.literal('deleted'),
        z.literal('unauthorized'),
        z.literal('offline'),
        z.literal('error'),
      ])
      .optional(),
    error: z.any().optional(),
  }),
  z.object({
    kind: z.literal('value'),
    value: z.any(),
    error: z.any().optional(),
  }),
]);

export const setValueMessageSchema = z.object({
  type: z.literal('set_value'),
  // TODO: Replace key with targets.
  key: z.string(),
  data: z.any(),
  // TODO: Define action targets.
  targets: z.any().optional(),
});

export const deleteMessageSchema = z.object({
  type: z.literal('delete'),
  // TODO: Replace key with targets.
  key: z.string(),
  // TODO: Define action targets.
  targets: z.any().optional(),
});

export const subscribeMessageSchema = z.object({
  type: z.literal('subscribe'),
  // TODO: Replace key with targets.
  key: z.string(),
  // TODO: Define action targets.
  targets: z.any().optional(),
});

export const stateMessageSchema = z.object({
  type: z.literal('state'),
  // TODO: Replace key with targets.
  key: z.string(),
  state: liveStateSchema,
  // TODO: Define action targets.
  targets: z.any().optional(),
});

export const protocolMessageSchema = z.discriminatedUnion('type', [
  setValueMessageSchema,
  deleteMessageSchema,
  subscribeMessageSchema,
]);

export type LiveStateLike<T = unknown> =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{
      kind: 'absent';
      reason?: 'not_found' | 'deleted' | 'unauthorized' | 'offline' | 'error';
      error?: unknown;
    }>
  | Readonly<{
      kind: 'value';
      value: T;
      error?: unknown;
    }>;

export interface Message<T = unknown> {
  // clientId: string;
  // clientTimestamp: string;
  type: string;
  // TODO: Replace `key` with `targets` in the future.
  key: string;
  // eventId: string;
  data?: T;
  // TODO: Define action targets.
  targets?: any;
  // TODO: Define action dependencies.
  // dependencies: any;
}

export interface SetValueMessage<T = unknown> extends Message<T> {
  type: 'set_value';
  data: T;
}

export interface DeleteMessage extends Message {
  type: 'delete';
  data?: never;
}

export interface SubscribeMessage extends Message {
  type: 'subscribe';
  data?: never;
}

export interface StateMessage<T = unknown> extends Omit<Message<T>, 'data'> {
  type: 'state';
  state: LiveStateLike<T>;
}
