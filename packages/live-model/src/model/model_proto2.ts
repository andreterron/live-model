import { ZodType } from 'zod';

export type ModelCreateParams<DEF> = DEF extends {}
  ? {
      [K in keyof DEF as DEF[K] extends ZodType<any, any, any>
        ? K
        : never]: DEF[K] extends ZodType<any, any, infer INPUT> ? INPUT : never;
    }
  : never;

export type ModelCreateOutput<DEF> = DEF extends {}
  ? {
      [K in keyof DEF]: DEF[K] extends ZodType<infer OUTPUT, any, any>
        ? OUTPUT
        : DEF[K];
    }
  : DEF;

export function calc(fn: (input: any) => any) {}

export function model<DEF extends {}>(def: DEF) {
  return {
    create(values: ModelCreateParams<DEF>): ModelCreateOutput<DEF> {
      return Object.fromEntries(
        Object.entries(def).map(([k, v]) => {
          return v instanceof ZodType
            ? v.parse((values as any)[k])
            : (values as any)[k];
        })
      ) as any;
    },
  };
}
