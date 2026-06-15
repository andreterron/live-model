import { z } from 'zod';

// TODO: The zod schemas and interfaces aren't linked. Parsing with the
// schema should yield the right types. Tricky because of generics.
// Maybe remove generics from Messages
// TODO: Update to zod 4

export const protocolMessageSchema = z.object({
  type: z.string(),
  // TODO: Replace key with targets.
  key: z.string(),
  data: z.any().optional(),
  // TODO: Define action targets.
  targets: z.any().optional(),
});

export const snapshotMessageSchema = z.object({
  type: z.literal('snapshot'),
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

export interface SnapshotMessage<T = unknown> extends Message<T> {
  type: 'snapshot';
  data: T;
}

export interface DeleteMessage extends Message {
  type: 'delete';
  data?: never;
}
