import { z } from 'zod';

export interface Operation {
  type: string;
  data?: unknown;
}

export const operationSchema = z
  .object({
    type: z.string(),
    data: z.any().optional(),
  })
  .passthrough();

export const operationsSchema = z.array(operationSchema) as z.ZodType<
  Operation[]
>;

/** Describes a family of serializable operations. */
export type OperationDefinitions = Record<string, object>;

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
