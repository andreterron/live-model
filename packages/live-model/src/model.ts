import { ZodType } from 'zod';

export type ObjectFromDef<DEF> = DEF extends {}
  ? {
      [K in keyof DEF]: DEF[K] extends TypeDef<infer U>
        ? ObjectFromDef<U>
        : DEF[K] extends PropDef<infer U, any>
        ? U
        : DEF[K] extends ZodType<infer U, any, any>
        ? U
        : DEF[K];
    }
  : DEF;

// TODO: Optional params, calculated params, etc
export type CreateParam<DEF> = DEF extends {}
  ? {
      [K in keyof DEF as DEF[K] extends PropDef<any, never>
        ? never
        : K]: DEF[K] extends TypeDef<infer U>
        ? ObjectFromDef<U>
        : DEF[K] extends PropDef<any, infer U>
        ? U
        : DEF[K] extends ZodType<any, any, infer U>
        ? U
        : DEF[K];
    }
  : DEF;

export type Extended<T> = T extends {}
  ? {
      [K in keyof T as T[K] extends undefined ? K | never : K]: T[K];
    }
  : T;

export type Merge<T, U> = T extends {}
  ? U extends {}
    ? {
        [K in keyof T | keyof U]: K extends keyof U
          ? U[K]
          : K extends keyof T
          ? T[K]
          : never;
      }
    : T & U
  : T & U;

export type PropDef<TYPE, CREATE = TYPE> = {
  _type: TYPE;
  _create: CREATE;
};

export type CalculatedPropDef<DEF, S> = PropDef<S, never> & {
  fn: (values: ObjectFromDef<DEF>) => S;
};

export type TypeDef<DEF> = {
  create(values: CreateParam<DEF>): ObjectFromDef<DEF>;
  extend<T>(
    extendDef: (params: {
      calc: <S>(fn: (values: ObjectFromDef<DEF>) => S) => PropDef<S, never>;
    }) => T
  ): TypeDef<Merge<DEF, Extended<T>>>;
};

export function model<TYPE>(): TypeDef<TYPE>;
export function model<DEF>(def: DEF): TypeDef<DEF>;
export function model<DEF>(def: DEF, extensions?: any[]): TypeDef<DEF>;
export function model<DEF>(def?: DEF, extensions: any[] = []): TypeDef<DEF> {
  return {
    create(values) {
      // TODO: Type
      let obj: any = values;
      if (def && typeof def === 'object') {
        obj = Object.fromEntries(
          Object.entries(def).map(([k, v]) => {
            return v instanceof ZodType
              ? v.parse((values as any)[k])
              : (values as any)[k];
          })
        ) as any; // TODO
      }
      for (let extension of extensions) {
        for (let [k, v] of Object.entries(extension)) {
          // TODO: Support extensions defined with zod
          if (
            typeof v === 'object' &&
            v &&
            'fn' in v &&
            typeof v.fn === 'function'
          ) {
            obj[k] = v.fn(obj);
          }
        }
      }
      return obj;
    },
    extend(def) {
      // TODO: CalculatedPropDef<S> = PropDef<S, never> & { fn }
      // TODO: Merge extension with previous extension
      const extension = def({
        calc: <S>(
          fn: (values: ObjectFromDef<DEF>) => S
        ): CalculatedPropDef<DEF, S> => {
          return {
            _type: undefined as S,
            fn,
          } as CalculatedPropDef<DEF, S>;
        },
      });
      return model(def, [...extensions, extension]) as any;
    },
  };
}
