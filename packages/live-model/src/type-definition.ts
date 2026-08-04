import { z } from 'zod';

export type TypeReducer<State, Data> = (state: State, data: Data) => State;

type StoredTypeReducer<Data> = {
  bivarianceHack(state: unknown, data: Data): unknown;
}['bivarianceHack'];

type StoredArgumentlessReducer = {
  bivarianceHack(state: unknown): unknown;
}['bivarianceHack'];

export interface TypeOperationDefinition<
  Name extends string = string,
  Schema extends z.ZodTypeAny = z.ZodTypeAny,
  HasArgument extends boolean = boolean
> {
  readonly name: Name;
  readonly schema: Schema;
  readonly hasArgument: HasArgument;
  readonly reducer?: StoredTypeReducer<z.output<Schema>>;
}

export type TypeOperationDefinitions = Record<
  string,
  TypeOperationDefinition<string, z.ZodTypeAny, boolean>
>;

export interface TypeDefinition<
  Name extends string = string,
  Operations extends TypeOperationDefinitions = TypeOperationDefinitions
> {
  readonly name: Name;
  readonly operations: Readonly<Operations>;
}

type OperationDefinitionFor<
  Name extends string,
  Schema extends z.ZodTypeAny,
  HasArgument extends boolean
> = TypeOperationDefinition<Name, Schema, HasArgument>;

export type OperationOfTypeDefinitions<
  Definitions extends TypeOperationDefinitions
> = {
  [Name in keyof Definitions &
    string]: Definitions[Name] extends TypeOperationDefinition<
    string,
    infer Schema,
    infer HasArgument
  >
    ? HasArgument extends true
      ? { type: Name; data: z.input<Schema> }
      : { type: Name }
    : never;
}[keyof Definitions & string];

export type OperationOfType<Definition extends TypeDefinition> =
  OperationOfTypeDefinitions<Definition['operations']>;

const noArgumentSchema = z.undefined();

export class TypeBuilder<
  Name extends string,
  Operations extends TypeOperationDefinitions = Record<never, never>
> implements TypeDefinition<Name, Operations>
{
  constructor(
    readonly name: Name,
    readonly operations: Readonly<Operations> = Object.freeze(
      {}
    ) as Readonly<Operations>
  ) {
    Object.freeze(this);
  }

  operation<const OperationName extends string>(
    name: OperationName extends keyof Operations ? never : OperationName
  ): TypeBuilder<
    Name,
    Operations &
      Record<
        OperationName,
        OperationDefinitionFor<OperationName, typeof noArgumentSchema, false>
      >
  >;
  operation<const OperationName extends string, State = unknown>(
    name: OperationName extends keyof Operations ? never : OperationName,
    schema: undefined,
    reducer?: (state: State) => State
  ): TypeBuilder<
    Name,
    Operations &
      Record<
        OperationName,
        OperationDefinitionFor<OperationName, typeof noArgumentSchema, false>
      >
  >;
  operation<
    const OperationName extends string,
    Schema extends z.ZodTypeAny,
    State = unknown
  >(
    name: OperationName extends keyof Operations ? never : OperationName,
    schema: Schema,
    reducer?: TypeReducer<State, z.output<Schema>>
  ): TypeBuilder<
    Name,
    Operations &
      Record<OperationName, OperationDefinitionFor<OperationName, Schema, true>>
  >;
  operation(
    name: string,
    schema?: z.ZodTypeAny,
    reducer?: StoredTypeReducer<unknown> | StoredArgumentlessReducer
  ): TypeBuilder<Name, TypeOperationDefinitions> {
    if (Object.prototype.hasOwnProperty.call(this.operations, name)) {
      throw new Error(`Operation "${name}" is already defined`);
    }

    const hasArgument = schema !== undefined;
    const definition = Object.freeze({
      name,
      schema: schema ?? noArgumentSchema,
      hasArgument,
      ...(reducer === undefined ? {} : { reducer }),
    });

    return new TypeBuilder(
      this.name,
      Object.freeze({
        ...this.operations,
        [name]: definition,
      })
    );
  }
}

export function buildType<const Name extends string>(
  name: Name
): TypeBuilder<Name> {
  return new TypeBuilder(name);
}

export function parseTypeOperation<Definition extends TypeDefinition>(
  definition: Definition,
  operation: unknown
): OperationOfType<Definition> {
  if (
    typeof operation !== 'object' ||
    operation === null ||
    typeof (operation as { type?: unknown }).type !== 'string'
  ) {
    throw new Error('A type operation must have a string "type"');
  }

  const type = (operation as { type: string }).type;
  const operationDefinition = definition.operations[type];
  if (!operationDefinition) {
    throw new Error(
      `Operation "${type}" is not defined for type "${definition.name}"`
    );
  }

  if (!operationDefinition.hasArgument) {
    operationDefinition.schema.parse((operation as { data?: unknown }).data);
    return { type } as OperationOfType<Definition>;
  }

  const data = operationDefinition.schema.parse(
    (operation as { data?: unknown }).data
  );
  return { type, data } as OperationOfType<Definition>;
}

export function reduceTypeOperation<State, Definition extends TypeDefinition>(
  definition: Definition,
  state: State,
  operation: OperationOfType<Definition>
): State {
  const parsedOperation = parseTypeOperation(definition, operation) as {
    type: string;
    data?: unknown;
  };
  const operationDefinition = definition.operations[parsedOperation.type];

  if (!operationDefinition.reducer) {
    return state;
  }

  const reducedState = operationDefinition.hasArgument
    ? operationDefinition.reducer(state, parsedOperation.data)
    : operationDefinition.reducer(state, undefined);

  return reducedState as State;
}
