import { z } from 'zod';
import type { Message } from './message.js';

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
