import { z } from 'zod';
import {
  buildType,
  parseTypeOperation,
  reduceTypeOperation,
  type OperationOfType,
} from '../src/type-definition.js';

describe('type definitions', () => {
  test('builds immutable definitions with inferred operation types', () => {
    const counterType = buildType('counter')
      .operation('increment', z.number(), (state: number, amount) => {
        return state + amount;
      })
      .operation('reset');

    type CounterOperation = OperationOfType<typeof counterType>;
    expectTypeOf<CounterOperation>().toEqualTypeOf<
      { type: 'increment'; data: number } | { type: 'reset' }
    >();

    expect(counterType.name).toBe('counter');
    expect(counterType.operations.increment.name).toBe('increment');
    expect(counterType.operations.increment.schema.parse(2)).toBe(2);
    expect(
      counterType.operations.reset.schema.parse(undefined)
    ).toBeUndefined();
    expect(Object.isFrozen(counterType)).toBe(true);
    expect(Object.isFrozen(counterType.operations)).toBe(true);
    expect(Object.isFrozen(counterType.operations.increment)).toBe(true);
  });

  test('parses operation arguments with their schemas', () => {
    const type = buildType('counter')
      .operation('increment', z.coerce.number())
      .operation('reset');

    expect(parseTypeOperation(type, { type: 'increment', data: '2' })).toEqual({
      type: 'increment',
      data: 2,
    });
    expect(() =>
      parseTypeOperation(type, { type: 'increment', data: 'nope' })
    ).toThrow();
    expect(parseTypeOperation(type, { type: 'reset' })).toEqual({
      type: 'reset',
    });
    expect(() =>
      parseTypeOperation(type, { type: 'reset', data: 'unexpected' })
    ).toThrow();
    expect(() => parseTypeOperation(type, { type: 'missing' })).toThrow(
      'is not defined for type "counter"'
    );
  });

  test('uses a reducer when present', () => {
    const counterType = buildType('counter').operation(
      'increment',
      z.number(),
      (state: number, amount) => {
        return state + amount;
      }
    );

    expect(
      reduceTypeOperation(counterType, 3, {
        type: 'increment',
        data: 2,
      })
    ).toBe(5);
  });

  test('does not change state when an operation has no reducer', () => {
    const arrayType = buildType('array').operation('insert', z.unknown());
    const state = ['first'];

    expect(
      reduceTypeOperation(arrayType, state, {
        type: 'insert',
        data: 'second',
      })
    ).toBe(state);
  });

  test('rejects duplicate operation names', () => {
    const builder = buildType('counter').operation('increment', z.number());

    expect(() =>
      (builder.operation as (name: string) => unknown)('increment')
    ).toThrow('Operation "increment" is already defined');
  });
});
