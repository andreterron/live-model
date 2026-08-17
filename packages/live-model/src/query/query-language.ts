import {
  FieldCondition,
  allInterpreters,
  allParsingInstructions,
  createFactory,
  type Condition,
  type FieldInstruction,
  type JsInterpreter,
} from '@ucast/mongo2js';

export type JsonScalar = string | number | boolean;

export type StringMatchOperand =
  | string
  | {
      value: string;
      caseSensitive?: boolean;
    };

export interface NormalizedStringMatch {
  value: string;
  caseSensitive: boolean;
}

type ScalarOperators<T extends JsonScalar> = {
  $eq?: T;
  $ne?: T;
  $in?: T[];
  $nin?: T[];
} & (T extends string | number
  ? {
      $lt?: T;
      $lte?: T;
      $gt?: T;
      $gte?: T;
    }
  : {}) &
  (T extends string
    ? {
        $startsWith?: StringMatchOperand;
        $containsText?: StringMatchOperand;
        $endsWith?: StringMatchOperand;
      }
    : {});

type FieldQuery<T> = T extends JsonScalar
  ? T | ScalarOperators<T>
  : T extends readonly (infer Item)[]
  ? Extract<Item, JsonScalar> extends never
    ? never
    : { $contains?: Extract<Item, JsonScalar> }
  : never;

type QueryPath<T, Depth extends unknown[] = []> = Depth['length'] extends 6
  ? never
  : T extends readonly (infer Item)[]
  ?
      | `${number}`
      | (QueryPath<Item, [...Depth, unknown]> extends infer Child extends string
          ? `${number}.${Child}`
          : never)
  : T extends object
  ? {
      [Key in keyof T & string]: T[Key] extends JsonScalar | readonly unknown[]
        ?
            | Key
            | (QueryPath<
                T[Key],
                [...Depth, unknown]
              > extends infer Child extends string
                ? `${Key}.${Child}`
                : never)
        : QueryPath<
            T[Key],
            [...Depth, unknown]
          > extends infer Child extends string
        ? `${Key}.${Child}`
        : never;
    }[keyof T & string]
  : never;

type QueryPathValue<
  T,
  Path extends string
> = Path extends `${infer Head}.${infer Tail}`
  ? T extends readonly (infer Item)[]
    ? QueryPathValue<Item, Tail>
    : Head extends keyof T
    ? QueryPathValue<T[Head], Tail>
    : never
  : T extends readonly (infer Item)[]
  ? Item
  : Path extends keyof T
  ? T[Path]
  : never;

type TypedLiveFilter<T> = {
  [Path in QueryPath<T>]?: FieldQuery<QueryPathValue<T, Path>>;
} & {
  $and?: TypedLiveFilter<T>[];
  $or?: TypedLiveFilter<T>[];
  $nor?: TypedLiveFilter<T>[];
};

export type DynamicLiveFilter = Record<string, unknown> & {
  $and?: DynamicLiveFilter[];
  $or?: DynamicLiveFilter[];
  $nor?: DynamicLiveFilter[];
};

export type LiveFilter<T = unknown> = unknown extends T
  ? DynamicLiveFilter
  : TypedLiveFilter<T>;

export const defaultQueryLimit = 100;
export const maximumQueryLimit = 10_000;

export interface LiveQuery<T = unknown> {
  filter: LiveFilter<T>;
  limit?: number;
}

export interface NormalizedLiveQuery<T = unknown> extends LiveQuery<T> {
  limit: number;
}

export function normalizeQueryLimit(limit?: number): number {
  if (limit === undefined) {
    return defaultQueryLimit;
  }
  if (!Number.isFinite(limit) || limit < 0) {
    throw new TypeError('Query limit must be a non-negative finite number');
  }
  return Math.min(Math.trunc(limit), maximumQueryLimit);
}

export function normalizeLiveQuery<T>(
  query: LiveQuery<T>
): NormalizedLiveQuery<T> {
  return { ...query, limit: normalizeQueryLimit(query.limit) };
}

function isScalar(value: unknown): value is JsonScalar {
  return (
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'boolean'
  );
}

const scalarInstruction: FieldInstruction<JsonScalar> = {
  type: 'field',
  validate(instruction, value) {
    if (!isScalar(value)) {
      throw new TypeError(`"${instruction.name}" expects a JSON scalar`);
    }
  },
};

const comparableInstruction: FieldInstruction<string | number> = {
  type: 'field',
  validate(instruction, value) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new TypeError(`"${instruction.name}" expects a string or number`);
    }
  },
};

const membershipInstruction: FieldInstruction<JsonScalar[]> = {
  type: 'field',
  validate(instruction, value) {
    if (!Array.isArray(value) || !value.every(isScalar)) {
      throw new TypeError(
        `"${instruction.name}" expects an array of JSON scalars`
      );
    }
  },
};

function normalizeStringMatch(
  instructionName: string,
  operand: unknown
): NormalizedStringMatch {
  if (typeof operand === 'string') {
    return { value: operand, caseSensitive: true };
  }

  if (
    typeof operand !== 'object' ||
    operand === null ||
    Array.isArray(operand) ||
    typeof (operand as { value?: unknown }).value !== 'string' ||
    ('caseSensitive' in operand &&
      typeof (operand as { caseSensitive?: unknown }).caseSensitive !==
        'boolean')
  ) {
    throw new TypeError(
      `"${instructionName}" expects a string or ` +
        '{ value: string, caseSensitive?: boolean }'
    );
  }

  return {
    value: (operand as { value: string }).value,
    caseSensitive:
      (operand as { caseSensitive?: boolean }).caseSensitive ?? true,
  };
}

const stringMatchInstruction: FieldInstruction<StringMatchOperand> = {
  type: 'field',
  parse(instruction, operand, context) {
    return new FieldCondition(
      instruction.name,
      context.field,
      normalizeStringMatch(instruction.name, operand)
    );
  },
};

const supportedParsingInstructions = {
  $and: allParsingInstructions.$and,
  $or: allParsingInstructions.$or,
  $nor: allParsingInstructions.$nor,
  $eq: scalarInstruction,
  $ne: scalarInstruction,
  $lt: comparableInstruction,
  $lte: comparableInstruction,
  $gt: comparableInstruction,
  $gte: comparableInstruction,
  $in: membershipInstruction,
  $nin: membershipInstruction,
  $contains: scalarInstruction,
  $startsWith: stringMatchInstruction,
  $containsText: stringMatchInstruction,
  $endsWith: stringMatchInstruction,
};

const sameScalarType = (left: unknown, right: unknown) =>
  isScalar(left) && isScalar(right) && typeof left === typeof right;

function onField<T>(
  evaluate: (condition: FieldCondition<T>, value: unknown) => boolean
): JsInterpreter<FieldCondition<T>> {
  return (condition, object, context) =>
    evaluate(condition, context.get(object, condition.field));
}

const eq = onField<JsonScalar>(
  (condition, value) =>
    sameScalarType(value, condition.value) && value === condition.value
);

const ne = onField<JsonScalar>(
  (condition, value) =>
    sameScalarType(value, condition.value) && value !== condition.value
);

function comparison(
  compare: (left: string | number, right: string | number) => boolean
): JsInterpreter<FieldCondition<string | number>> {
  return onField(
    (condition, value) =>
      (typeof value === 'string' || typeof value === 'number') &&
      typeof value === typeof condition.value &&
      compare(value, condition.value)
  );
}

const within = onField<JsonScalar[]>(
  (condition, value) =>
    isScalar(value) &&
    condition.value.some(
      (candidate) => sameScalarType(value, candidate) && value === candidate
    )
);

const nin = onField<JsonScalar[]>(
  (condition, value) =>
    isScalar(value) &&
    !condition.value.some(
      (candidate) => sameScalarType(value, candidate) && value === candidate
    )
);

const contains = onField<JsonScalar>(
  (condition, value) =>
    Array.isArray(value) &&
    value.some(
      (item) =>
        sameScalarType(item, condition.value) && item === condition.value
    )
);

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) + 32)
  );
}

function stringMatch(
  match: (value: string, operand: string) => boolean
): JsInterpreter<FieldCondition<NormalizedStringMatch>> {
  return onField((condition, value) => {
    if (typeof value !== 'string') return false;
    const operand = condition.value.value;
    return condition.value.caseSensitive
      ? match(value, operand)
      : match(asciiLower(value), asciiLower(operand));
  });
}

const queryGuardFactory = createFactory(
  supportedParsingInstructions,
  {
    and: allInterpreters.and,
    or: allInterpreters.or,
    nor: allInterpreters.nor,
    eq,
    ne,
    lt: comparison((left, right) => left < right),
    lte: comparison((left, right) => left <= right),
    gt: comparison((left, right) => left > right),
    gte: comparison((left, right) => left >= right),
    in: within,
    nin,
    contains,
    startsWith: stringMatch((value, operand) => value.startsWith(operand)),
    containsText: stringMatch((value, operand) => value.includes(operand)),
    endsWith: stringMatch((value, operand) => value.endsWith(operand)),
  },
  {
    get(object: unknown, path: string) {
      let value = object;
      for (const segment of path.split('.')) {
        if (typeof value !== 'object' || value === null) {
          return undefined;
        }
        if (!Object.prototype.hasOwnProperty.call(value, segment)) {
          return undefined;
        }
        value = (value as Record<string, unknown>)[segment];
      }
      return value;
    },
  }
);

export interface LiveFilterGuard<T = unknown> {
  (value: T): boolean;
  ast: Condition;
}

export function createLiveFilterGuard<T = unknown>(
  filter: LiveFilter<T>
): LiveFilterGuard<T> {
  // TODO: Try to remove `as never`
  return queryGuardFactory(filter as never) as LiveFilterGuard<T>;
}
