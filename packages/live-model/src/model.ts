import { ZodType } from 'zod';
import { Live, LocalStorageLive } from './live.js';
import { genId } from './id.js';

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
  kind: 'calculated';
  fn: (values: ObjectFromDef<DEF>) => S;
};

export type ActionPropDef<DEF, S> = PropDef<S, never> & {
  kind: 'action';
  fn: (values: ObjectFromDef<DEF>) => S;
};

export type AnyPropDef<DEF, S> =
  | CalculatedPropDef<DEF, S>
  | ActionPropDef<DEF, S>;

export type TypeDef<DEF> = {
  // TODO: Remove `| undefined`
  create(values: CreateParam<DEF>): Live<ObjectFromDef<DEF> | undefined>;
  getOrCreate(
    id: string,
    createValues: CreateParam<DEF>
  ): Live<ObjectFromDef<DEF> | undefined>;
  // TODO: This definition doesn't support model<boolean | number | string>, because we always assume T is an object.
  // TODO: actions and value types might need to be separate
  // TODO: a "calculated property" might not make sense for native types... right?
  extend<T>(
    extendDef: (params: {
      calc: <S>(fn: (values: ObjectFromDef<DEF>) => S) => PropDef<S, never>;
      action: <S>(fn: (values: ObjectFromDef<DEF>) => S) => PropDef<S, never>;
    }) => T
  ): TypeDef<Merge<DEF, Extended<T>>>;
};

export function model<TYPE>(): TypeDef<TYPE>;
export function model<DEF>(def: DEF): TypeDef<DEF>;
export function model<DEF>(def: DEF, extensions?: any[]): TypeDef<DEF>;
export function model<DEF>(def?: DEF, extensions: any[] = []): TypeDef<DEF> {
  return {
    create(values) {
      // TODO: A model may specify the ID generation. A model may need to
      //       specify some kind of "prefix", "domain" or "namespace".
      // TODO: Change `(values as any).__id`
      const id = (values as any).__id || genId();
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
      // TODO: Review how we're saving to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(id, JSON.stringify(obj));
      }
      // TODO: Can the type of Live (normal, localstorage, db, etc) be customizable?
      // TODO: Set the value of localstorage to the object
      // TODO: Is .create the right function? Feels like it's more "reading" the value from localStorage instead of creating.
      return new LocalStorageLive(id);
    },
    // TODO: This reads like a hack. Maybe a `createIfEmpty` option on `.get`, or a wrapper
    getOrCreate(id, createValues) {
      if (
        typeof localStorage === 'undefined' ||
        localStorage.getItem(id) !== null
      ) {
        return new LocalStorageLive(id);
      }
      return this.create({ ...createValues, __id: id });
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
            kind: 'calculated',
            fn,
          } as CalculatedPropDef<DEF, S>;
        },
        action: <S>(
          fn: (values: ObjectFromDef<DEF>) => S
        ): ActionPropDef<DEF, S> => {
          return {
            _type: undefined as S,
            kind: 'action',
            fn,
          } as ActionPropDef<DEF, S>;
        },
      });
      return model(def, [...extensions, extension]) as any;
    },
  };
}
