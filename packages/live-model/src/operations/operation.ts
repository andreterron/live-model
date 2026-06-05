export type Operation<ID extends string = string, T = any> = undefined extends T
  ? {
      id: ID;
      arg?: T;
    }
  : {
      id: ID;
      arg: T;
    };

export type OperationHandler<T> = (
  prev: T,
  arg: any,
  utils: { skip: () => never }
) => T;

export type OperationDefinition<T> = Record<string, OperationHandler<T>>;

type Values<T extends { [k: string]: any }> = T[keyof T];

export type OperationsFromHandler<Handler extends OperationDefinition<any>> =
  Values<{
    [K in Extract<keyof Handler, string>]: Operation<
      K,
      Parameters<Handler[K]>[1]
    >;
  }>;

// TODO: Can't do with Operation I think
export type DispatchType<T, OP extends OperationDefinition<T>> = Values<{
  // TODO: Return
  // TODO: Maybe create a simpler type to store this data. { [event]: arg }
  [K in Extract<keyof OP, string>]: (
    event: K,
    arg?: Parameters<OP[K]>[1]
  ) => void;
}>;
