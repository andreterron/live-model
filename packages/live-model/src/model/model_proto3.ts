import { ZodType } from 'zod';

export type CalcParam<DEF> = DEF extends {}
  ? {
      [K in keyof DEF as DEF[K] extends ZodType<any, any, any>
        ? K
        : never]: DEF[K] extends ZodType<infer OUTPUT, any, any>
        ? OUTPUT
        : never;
    }
  : never;

export class BaseModel<T> {
  protected _calc<U>(fn: (instance: CalcParam<T>) => U) {
    // TODO: Implement
  }
}
