import { z } from 'zod';
import {
  buildArrayType,
  tArray,
  type OperationOfType,
} from '../../src/index.js';

describe('array type', () => {
  test('provides a reusable insert operation definition', () => {
    expect(tArray.name).toBe('array');
    expect(tArray.operations.insert.name).toBe('insert');
    expect(tArray.operations.insert.reducer).toBeUndefined();
    expect(tArray.operations.insert.schema.parse({ any: 'value' })).toEqual({
      any: 'value',
    });
  });

  test('can constrain inserted items with a consumer schema', () => {
    const stringArray = buildArrayType(z.string());
    type StringArrayOperation = OperationOfType<typeof stringArray>;

    expectTypeOf<StringArrayOperation>().toEqualTypeOf<{
      type: 'insert';
      data: string;
    }>();
    expect(stringArray.operations.insert.schema.safeParse('item').success).toBe(
      true
    );
    expect(stringArray.operations.insert.schema.safeParse(1).success).toBe(
      false
    );
  });
});
