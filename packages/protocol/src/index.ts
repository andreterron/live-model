import { z } from 'zod';

export const allKeysKey = '_livemodel.all_keys';

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
  [key in Exclude<AbsentReason, 'error'> | '_']: LiveStateAbsent;
}> = Object.freeze({
  not_found: { kind: 'absent', reason: 'not_found' },
  deleted: { kind: 'absent', reason: 'deleted' },
  unauthorized: { kind: 'absent', reason: 'unauthorized' },
  offline: { kind: 'absent', reason: 'offline' },
  _: { kind: 'absent' },
});

export const LiveState = Object.freeze({
  loading: Object.freeze({ kind: 'loading' }) as LiveStateLoading,
  value<T>(value: T): LiveStateValue<T> {
    return Object.freeze({ kind: 'value', value });
  },
  absent(reason?: AbsentReason, error?: unknown): LiveStateAbsent {
    if (!reason) {
      return cachedAbsentStates['_'];
    }

    if (reason !== 'error') {
      return cachedAbsentStates[reason];
    }

    return Object.freeze({ kind: 'absent', reason, error });
  },
});

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
  data: z.any(),
});

export const deleteOperationSchema = z.object({
  type: z.literal('delete'),
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
  key: z.string(),
  operation: operationSchema,
});

export const protocolMessageSchema = z.discriminatedUnion('type', [
  operationMessageSchema,
  subscribeMessageSchema,
  unsubscribeMessageSchema,
]);

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
}

/**
 * Describes the operations supported by a Live. Definition objects deliberately
 * have room for future metadata in addition to their argument type.
 */
export type OperationDefinitions = Record<string, object>;

export type DefaultOperations<T = unknown> = {
  set_value: { data: T };
  delete: object;
};

export type OperationName<OPS extends OperationDefinitions> = keyof OPS &
  string;

export type OperationData<
  OPS extends OperationDefinitions,
  K extends OperationName<OPS>
> = OPS[K] extends { data: infer Data } ? Data : void;

export type OperationArgs<
  OPS extends OperationDefinitions,
  K extends OperationName<OPS>
> = OPS[K] extends { data: infer Data } ? [data: Data] : [];

export type OperationOf<OPS extends OperationDefinitions> = {
  [K in OperationName<OPS>]: OPS[K] extends { data: infer Data }
    ? { type: K; data: Data }
    : { type: K };
}[OperationName<OPS>];

export type SetValueOperation<T = unknown> = OperationOf<
  Pick<DefaultOperations<T>, 'set_value'>
>;

export type DeleteOperation = OperationOf<Pick<DefaultOperations, 'delete'>>;

/** @deprecated Prefer OperationOf<OPS> for a particular Live. */
export type AnyOperation<T = unknown> = OperationOf<DefaultOperations<T>>;

// Zod 3 infers properties using z.any() as optional. The wire format still
// requires data for set_value, so expose the schema with the protocol type.
export const operationsSchema = z.array(operationSchema) as z.ZodType<
  AnyOperation[]
>;

export const operationMessagesSchema = z.array(
  operationMessageSchema
) as z.ZodType<OperationMessage[]>;

export interface OperationMessage<T = unknown> extends Message {
  type: 'op';
  key: string;
  operation: AnyOperation<T>;
}

export interface OperationError {
  code: string;
  message?: string;
  details?: unknown;
}

export type OperationResult =
  | { status: 'success' }
  | { status: 'error'; error: OperationError };

export type OperationStatusMessage = Message & {
  type: 'op_status';
} & OperationResult;

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
  state: LiveState<T>;
  targets?: any;
}
