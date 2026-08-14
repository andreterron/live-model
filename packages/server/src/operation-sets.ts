import { buildType, parseLiveReference } from 'live-model';
import { z } from 'zod';

const rootLiveReferenceSchema = z
  .object({ $ref: z.string() })
  .strict()
  .superRefine((reference, context) => {
    try {
      const target = parseLiveReference(reference);
      if (!target || target.pointer !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Expected a reference to a root Live entity',
        });
      }
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof Error ? error.message : 'Invalid Live reference',
      });
    }
  });

export const counterOperationSet = buildType('counter')
  .operation('increment', z.number(), (state: number, amount) => {
    if (typeof state !== 'number') {
      throw new Error('increment requires a numeric counter value');
    }
    return state + amount;
  })
  .operation('reset', undefined, () => 0);

export const multisetOperationSet = buildType('multiset')
  .operation('insert', rootLiveReferenceSchema, (state: unknown, reference) => [
    ...parseMultiset(state),
    reference,
  ])
  .operation('remove', rootLiveReferenceSchema, (state: unknown, reference) => {
    const members = parseMultiset(state);
    const index = members.findIndex((member) => member.$ref === reference.$ref);
    return index === -1
      ? members
      : [...members.slice(0, index), ...members.slice(index + 1)];
  });

function parseMultiset(state: unknown): { $ref: string }[] {
  return z.array(rootLiveReferenceSchema).parse(state);
}
