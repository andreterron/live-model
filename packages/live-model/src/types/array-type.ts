import { z } from 'zod';
import {
  buildType,
  type TypeDefinition,
  type TypeOperationDefinition,
} from '../type-definition.js';

export type ArrayType<ItemSchema extends z.ZodTypeAny = z.ZodUnknown> =
  TypeDefinition<
    'array',
    Record<'insert', TypeOperationDefinition<'insert', ItemSchema, true>>
  >;

export function buildArrayType(): ArrayType;
export function buildArrayType<ItemSchema extends z.ZodTypeAny>(
  itemSchema: ItemSchema
): ArrayType<ItemSchema>;
export function buildArrayType(
  itemSchema: z.ZodTypeAny = z.unknown()
): TypeDefinition {
  return buildType('array').operation('insert', itemSchema);
}

/** A reusable array type whose inserted values may have any shape. */
export const tArray = buildArrayType();
