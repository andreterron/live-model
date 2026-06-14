import { z } from 'zod';

export const protocolMessageSchema = z.object({
  type: z.string(),
  data: z.any().optional(),
  // TODO: Define action targets.
  targets: z.any().optional(),
});

export interface Message<T = unknown> {
  // clientId: string;
  // clientTimestamp: string;
  type: string;
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
