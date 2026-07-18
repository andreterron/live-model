import { z } from 'zod';

export const allKeysKey = '_livemodel.all_keys';

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

export const setValueOperationSchema = z.object({
  type: z.literal('set_value'),
  // TODO: Replace key with targets.
  key: z.string(),
  data: z.any(),
  // TODO: Define action targets.
  targets: z.any().optional(),
});

export const deleteOperationSchema = z.object({
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

export const unsubscribeMessageSchema = z.object({
  type: z.literal('unsubscribe'),
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

export const operationStatusMessageSchema = z.discriminatedUnion('status', [
  z.object({
    type: z.literal('op_status'),
    status: z.literal('success'),
  }),
  z.object({
    type: z.literal('op_status'),
    status: z.literal('error'),
    error: z.object({
      code: z.string(),
      message: z.string().optional(),
      details: z.any().optional(),
    }),
  }),
]);

export const operationSchema = z.discriminatedUnion('type', [
  setValueOperationSchema,
  deleteOperationSchema,
]);

export const operationMessageSchema = z.object({
  type: z.literal('op'),
  operation: operationSchema,
});

export const protocolMessageSchema = z.discriminatedUnion('type', [
  operationMessageSchema,
  subscribeMessageSchema,
  unsubscribeMessageSchema,
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

export interface Message {
  // clientId: string;
  // clientTimestamp: string;
  type: string;
  // eventId: string;
  // TODO: Define action dependencies.
  // dependencies: any;
}

export interface Operation {
  type: string;
  key: string;
  targets?: any;
}

export interface SetValueOperation<T = unknown> extends Operation {
  type: 'set_value';
  data: T;
}

export interface DeleteOperation extends Operation {
  type: 'delete';
}

export type AnyOperation<T = unknown> =
  | SetValueOperation<T>
  | DeleteOperation;

// Zod 3 infers properties using z.any() as optional. The wire format still
// requires data for set_value, so expose the schema with the protocol type.
export const operationsSchema = z.array(operationSchema) as z.ZodType<
  AnyOperation[]
>;

export interface OperationMessage<T = unknown> extends Message {
  type: 'op';
  operation: AnyOperation<T>;
}

export interface OperationError {
  code: string;
  message?: string;
  details?: unknown;
}

export type OperationStatusMessage =
  | (Message & {
      type: 'op_status';
      status: 'success';
    })
  | (Message & {
      type: 'op_status';
      status: 'error';
      error: OperationError;
    });

export interface SubscribeMessage extends Message {
  type: 'subscribe';
  key: string;
  targets?: any;
}

export interface UnsubscribeMessage extends Message {
  type: 'unsubscribe';
  key: string;
  targets?: any;
}

export type ProtocolMessage<T = unknown> =
  | OperationMessage<T>
  | SubscribeMessage
  | UnsubscribeMessage;

export interface StateMessage<T = unknown> extends Message {
  type: 'state';
  key: string;
  state: LiveStateLike<T>;
  targets?: any;
}
