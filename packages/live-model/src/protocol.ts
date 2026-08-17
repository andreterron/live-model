import { z } from 'zod';
import type { LiveQuery } from './query/query-language.js';

export const allKeysKey = '_livemodel.all_keys';

export interface LiveReference {
  readonly $ref: string;
}

export interface LiveReferenceTarget {
  readonly key: string;
  readonly pointer?: string;
}

export function liveReference(key: string, pointer?: string): LiveReference {
  if (pointer !== undefined && pointer !== '' && !pointer.startsWith('/')) {
    throw new Error(
      'A Live reference JSON Pointer must be empty or start with "/"'
    );
  }

  const fragment =
    pointer === undefined
      ? ''
      : `#${encodeURIComponent(pointer).replace(/%2F/g, '/')}`;

  return Object.freeze({
    $ref: `live:${encodeURIComponent(key)}${fragment}`,
  });
}

/**
 * Parses the reserved, exact `{ $ref: string }` shape.
 *
 * Returns undefined for ordinary application data and throws for a malformed
 * reserved reference.
 */
export function parseLiveReference(
  value: unknown
): LiveReferenceTarget | undefined {
  if (!isPlainObject(value) || Object.keys(value).length !== 1) {
    return undefined;
  }

  if (!Object.prototype.hasOwnProperty.call(value, '$ref')) {
    return undefined;
  }

  if (typeof value.$ref !== 'string') {
    throw new Error('A Live reference must have a string "$ref"');
  }

  if (!value.$ref.startsWith('live:')) {
    throw new Error('A Live reference must use the "live:" scheme');
  }

  const address = value.$ref.slice('live:'.length);
  const fragmentIndex = address.indexOf('#');
  const encodedKey =
    fragmentIndex === -1 ? address : address.slice(0, fragmentIndex);
  const encodedPointer =
    fragmentIndex === -1 ? undefined : address.slice(fragmentIndex + 1);

  let key: string;
  let pointer: string | undefined;

  try {
    key = decodeURIComponent(encodedKey);
    pointer =
      encodedPointer === undefined
        ? undefined
        : decodeURIComponent(encodedPointer);
  } catch {
    throw new Error('A Live reference contains invalid URI encoding');
  }

  if (pointer !== undefined && pointer !== '' && !pointer.startsWith('/')) {
    throw new Error(
      'A Live reference JSON Pointer must be empty or start with "/"'
    );
  }

  return pointer === undefined ? { key } : { key, pointer };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export type AbsentReason =
  | 'not_found'
  | 'deleted'
  | 'unauthorized'
  | 'offline'
  | 'error';

export type LiveStateLoading = Readonly<{ kind: 'loading' }>;
export interface LiveMetadata {
  readonly op_set?: Readonly<{
    readonly root?: string;
    // Property operation sets are deferred until properties are independently
    // addressable Lives with their own operation histories. Today, changing a
    // JSON field is represented as set_value on the root Live.
    // readonly props?: Readonly<Record<string, string>>;
  }>;
}

export const emptyLiveMetadata: Readonly<LiveMetadata> = Object.freeze({});

export type LiveStateAbsent = Readonly<{
  kind: 'absent';
  reason?: AbsentReason;
  error?: unknown;
  metadata?: LiveMetadata;
}>;
export type LiveStateValue<T> = Readonly<{
  kind: 'value';
  value: T;
  metadata: LiveMetadata;
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
  value<T>(
    value: T,
    metadata: LiveMetadata = emptyLiveMetadata
  ): LiveStateValue<T> {
    return Object.freeze({ kind: 'value', value, metadata });
  },
  absent(
    reason?: AbsentReason,
    error?: unknown,
    metadata?: LiveMetadata
  ): LiveStateAbsent {
    if (metadata === undefined && reason === undefined) {
      return cachedAbsentStates['_'];
    }

    if (metadata === undefined && reason !== undefined && reason !== 'error') {
      return cachedAbsentStates[reason];
    }

    return Object.freeze({
      kind: 'absent',
      reason,
      ...(error === undefined ? {} : { error }),
      ...(metadata === undefined ? {} : { metadata }),
    });
  },
});

// TODO: The zod schemas and interfaces aren't linked. Parsing with the
// schema should yield the right types. Tricky because of generics.
// Maybe remove generics from Messages
// TODO: Update to zod 4

export const liveMetadataSchema = z.object({
  op_set: z
    .object({
      root: z.string().optional(),
    })
    .strict()
    .optional(),
});

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
    metadata: liveMetadataSchema.optional(),
  }),
  z.object({
    kind: z.literal('value'),
    value: z.any(),
    metadata: liveMetadataSchema.default({}),
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

export const setMetadataOperationSchema = z.object({
  type: z.literal('set_metadata'),
  data: liveMetadataSchema,
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

export const queryMessageSchema = z.object({
  type: z.literal('query'),
  queryId: z.string(),
  data_source: z.literal('entities'),
  query: z.object({
    // Filter operator validation is owned by the UCAST parser during execution.
    // TODO: Consider adding query type validation here.
    filter: z.record(z.unknown()),
    limit: z.number().finite().nonnegative().optional(),
  }),
});

export const unqueryMessageSchema = z.object({
  type: z.literal('unquery'),
  queryId: z.string(),
});

export const stateMessageSchema = z.object({
  type: z.literal('state'),
  // TODO: Replace key with targets.
  key: z.string(),
  state: liveStateSchema,
  // TODO: Define action targets.
  targets: z.any().optional(),
});

export const querySnapshotMessageSchema = z.object({
  type: z.literal('query_snapshot'),
  queryId: z.string(),
  items: z.array(
    z.object({
      key: z.string(),
      state: liveStateSchema,
    })
  ),
  range: z.object({
    hasMore: z.boolean(),
    cursor: z.string().optional(),
  }),
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

export const operationSchema = z
  .object({
    type: z.string(),
    data: z.any().optional(),
  })
  .passthrough();

export const operationMessageSchema = z.object({
  type: z.literal('op'),
  key: z.string(),
  operation: operationSchema,
});

export const protocolMessageSchema = z.discriminatedUnion('type', [
  operationMessageSchema,
  subscribeMessageSchema,
  unsubscribeMessageSchema,
  queryMessageSchema,
  unqueryMessageSchema,
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
  data?: unknown;
}

/**
 * Describes the operations supported by a Live. Definition objects deliberately
 * have room for future metadata in addition to their argument type.
 */
export type OperationDefinitions = Record<string, object>;

export type DefaultOperations<T = unknown> =
  | { type: 'set_value'; data: T }
  | { type: 'delete' }
  | { type: 'set_metadata'; data: LiveMetadata };

export type OperationName<OPS extends Operation> = OPS['type'];

export type OperationForName<
  OPS extends Operation,
  K extends OperationName<OPS>
> = OPS extends unknown ? (K extends OPS['type'] ? OPS : never) : never;

export type OperationData<
  OPS extends Operation,
  K extends OperationName<OPS>
> = OperationForName<OPS, K> extends { data: infer Data } ? Data : void;

export type OperationArgs<
  OPS extends Operation,
  K extends OperationName<OPS>
> = Operation extends OPS
  ? [data?: unknown]
  : OperationForName<OPS, K> extends { data: infer Data }
  ? [data: Data]
  : [];

export type OperationOf<OPS extends OperationDefinitions> = {
  [K in keyof OPS & string]: OPS[K] extends { data: infer Data }
    ? { type: K; data: Data }
    : { type: K };
}[keyof OPS & string];

export type SetValueOperation<T = unknown> = Extract<
  DefaultOperations<T>,
  { type: 'set_value' }
>;

export type DeleteOperation = Extract<DefaultOperations, { type: 'delete' }>;

export type SetMetadataOperation = Extract<
  DefaultOperations,
  { type: 'set_metadata' }
>;

/** @deprecated Prefer a specific Operation union for a particular Live. */
export type AnyOperation<T = unknown> = DefaultOperations<T>;

export const operationsSchema = z.array(operationSchema) as z.ZodType<
  Operation[]
>;

export const operationMessagesSchema = z.array(
  operationMessageSchema
) as z.ZodType<OperationMessage[]>;

export interface OperationMessage extends Message {
  type: 'op';
  key: string;
  operation: Operation;
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

export interface QueryMessage<T = unknown> extends Message {
  type: 'query';
  queryId: string;
  data_source: 'entities';
  query: LiveQuery<T>;
}

export interface UnqueryMessage extends Message {
  type: 'unquery';
  queryId: string;
}

export type ProtocolMessage =
  | OperationMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | QueryMessage
  | UnqueryMessage;

export interface StateMessage<T = unknown> extends Message {
  type: 'state';
  key: string;
  state: LiveState<T>;
  targets?: any;
}

export interface QuerySnapshotMessage<T = unknown> extends Message {
  type: 'query_snapshot';
  queryId: string;
  items: Array<{
    key: string;
    state: LiveState<T>;
  }>;
  range: {
    hasMore: boolean;
  };
}
