import { z } from 'zod';
import type { LiveState, Operation, OperationError } from './protocol.js';
import {
  buildType,
  parseTypeOperation,
  reduceTypeOperation,
  type OperationOfType,
  type TypeDefinition,
} from './type-definition.js';

export type OperationSetEffect =
  | { readonly action: 'unchanged' }
  | { readonly action: 'set'; readonly value: unknown }
  | { readonly action: 'delete' };

export type OperationSetProcessingResult =
  | ({ readonly status: 'success' } & OperationSetEffect)
  | { readonly status: 'error'; readonly error: OperationError };

export type OperationSetHandlerResult =
  | OperationSetEffect
  | { readonly action: 'error'; readonly error: OperationError };

export type OperationSetHandlers<Definition extends TypeDefinition> = Partial<{
  [Name in keyof Definition['operations'] & string]: (
    state: LiveState<unknown>,
    operation: Extract<OperationOfType<Definition>, { type: Name }>
  ) => OperationSetHandlerResult;
}>;

interface OperationSetRegistration {
  readonly definition: TypeDefinition;
  readonly handlers: Readonly<
    Record<
      string,
      (
        state: LiveState<unknown>,
        operation: Operation
      ) => OperationSetHandlerResult
    >
  >;
}

/** The implicit operation set used when Live metadata has no root assignment. */
export const defaultOperationSet = buildType('default')
  .operation('set_value', z.unknown())
  .operation('delete');

export const defaultOperationSetHandlers: OperationSetHandlers<
  typeof defaultOperationSet
> = {
  set_value: (_state, operation) => ({
    action: 'set',
    value: operation.data,
  }),
  delete: () => ({ action: 'delete' }),
};

/**
 * Stores executable operation-set definitions by their metadata ID.
 *
 * The registry is environment-independent. A backend can use it for canonical
 * processing while a frontend can use the same definitions for local or
 * optimistic processing.
 */
export class OperationSetRegistry {
  private readonly registrations = new Map<string, OperationSetRegistration>();

  constructor() {
    this.register(defaultOperationSet, defaultOperationSetHandlers);
  }

  register<Definition extends TypeDefinition>(
    definition: Definition,
    handlers: OperationSetHandlers<Definition> = {}
  ): this {
    if (this.registrations.has(definition.name)) {
      throw new Error(
        `Operation set "${definition.name}" is already registered`
      );
    }

    for (const operationName of Object.keys(handlers)) {
      if (
        !Object.prototype.hasOwnProperty.call(
          definition.operations,
          operationName
        )
      ) {
        throw new Error(
          `Handler "${operationName}" is not defined by operation set "${definition.name}"`
        );
      }
    }

    this.registrations.set(definition.name, {
      definition,
      handlers: handlers as unknown as OperationSetRegistration['handlers'],
    });
    return this;
  }

  has(id: string): boolean {
    return this.registrations.has(id);
  }

  get(id: string): TypeDefinition | undefined {
    return this.registrations.get(id)?.definition;
  }

  process(
    state: LiveState<unknown>,
    operation: Operation
  ): OperationSetProcessingResult {
    const id =
      (state.kind === 'loading' ? undefined : state.metadata?.op_set?.root) ??
      defaultOperationSet.name;

    const registration = this.registrations.get(id);
    if (!registration) {
      return operationError(
        'unknown_operation_set',
        `Operation set "${id}" is not registered`
      );
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        registration.definition.operations,
        operation.type
      )
    ) {
      return operationError(
        'unsupported_operation',
        `Operation "${operation.type}" is not defined for operation set "${id}"`
      );
    }

    let parsedOperation: Operation;
    try {
      parsedOperation = parseTypeOperation(
        registration.definition,
        operation
      ) as Operation;
    } catch (error) {
      return operationError(
        'invalid_operation',
        error instanceof Error ? error.message : 'Operation is invalid'
      );
    }

    const handler = registration.handlers[parsedOperation.type];
    if (handler) {
      try {
        const result = handler(state, parsedOperation);
        return result.action === 'error'
          ? { status: 'error', error: result.error }
          : { status: 'success', ...result };
      } catch (error) {
        return operationError(
          'operation_failed',
          error instanceof Error ? error.message : 'Operation handler failed'
        );
      }
    }

    const definition = registration.definition.operations[parsedOperation.type];
    if (!definition.reducer) {
      return { status: 'success', action: 'unchanged' };
    }

    if (state.kind !== 'value') {
      return operationError(
        'invalid_state',
        `Operation "${operation.type}" requires a value state`
      );
    }

    try {
      return {
        status: 'success',
        action: 'set',
        value: reduceTypeOperation(
          registration.definition,
          state.value,
          parsedOperation
        ),
      };
    } catch (error) {
      return operationError(
        'operation_failed',
        error instanceof Error ? error.message : 'Operation reducer failed'
      );
    }
  }
}

function operationError(
  code: string,
  message: string
): { readonly status: 'error'; readonly error: OperationError } {
  return { status: 'error', error: { code, message } };
}
