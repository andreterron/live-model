import {
  and,
  createSqlInterpreter,
  nor,
  or,
  sqlite,
  type Query,
  type SqlOperator,
} from '@ucast/sql';
import {
  createLiveFilterGuard,
  type JsonScalar,
  type LiveFilter,
  type NormalizedStringMatch,
} from './query-language.js';

type FieldNode<T> = {
  field: string;
  value: T;
};

function jsonPath(field: string): string {
  if (!field) {
    throw new TypeError('Query field paths cannot be empty');
  }

  return field
    .split('.')
    .reduce(
      (path, segment) =>
        /^(0|[1-9]\d*)$/.test(segment)
          ? `${path}[${segment}]`
          : `${path}.${JSON.stringify(segment)}`,
      '$'
    );
}

function scalarTypeSql(expression: string, value: JsonScalar): string {
  if (typeof value === 'string') {
    return `json_type(data, ${expression}) = 'text'`;
  }
  if (typeof value === 'number') {
    return `json_type(data, ${expression}) in ('integer', 'real')`;
  }
  return `json_type(data, ${expression}) in ('true', 'false')`;
}

function sqliteValue(value: JsonScalar): JsonScalar | number {
  return typeof value === 'boolean' ? Number(value) : value;
}

function scalarComparison(operator: string): SqlOperator<any> {
  return (condition: FieldNode<JsonScalar>, query: Query) => {
    const path = jsonPath(condition.field);
    const typePath = query.param(path);
    const valuePath = query.param(path);
    const value = query.param(sqliteValue(condition.value));
    return query.whereRaw(
      `(${scalarTypeSql(typePath, condition.value)} and ` +
        `json_extract(data, ${valuePath}) ${operator} ${value})`
    );
  };
}

function membership(isInverted: boolean): SqlOperator<any> {
  return (condition: FieldNode<JsonScalar[]>, query: Query) => {
    const scalarPath = isInverted
      ? query.param(jsonPath(condition.field))
      : undefined;
    const candidates = condition.value.map((candidate) => {
      const typePath = query.param(jsonPath(condition.field));
      const valuePath = query.param(jsonPath(condition.field));
      const value = query.param(sqliteValue(candidate));
      return (
        `(${scalarTypeSql(typePath, candidate)} and ` +
        `json_extract(data, ${valuePath}) = ${value})`
      );
    });

    if (candidates.length === 0) {
      if (!isInverted) {
        return query.whereRaw('1 = 0');
      }
      return query.whereRaw(
        `json_type(data, ${scalarPath}) in ` +
          "('text', 'integer', 'real', 'true', 'false')"
      );
    }

    const anyCandidate = `(${candidates.join(' or ')})`;
    if (!isInverted) {
      return query.whereRaw(anyCandidate);
    }

    return query.whereRaw(
      `(json_type(data, ${scalarPath}) in ` +
        `('text', 'integer', 'real', 'true', 'false') and not ${anyCandidate})`
    );
  };
}

const contains: SqlOperator<any> = (
  condition: FieldNode<JsonScalar>,
  query: Query
) => {
  const arrayPath = query.param(jsonPath(condition.field));
  const valuePath = query.param(jsonPath(condition.field));
  const value = query.param(sqliteValue(condition.value));
  const type =
    typeof condition.value === 'string'
      ? "'text'"
      : typeof condition.value === 'number'
      ? "'integer', 'real'"
      : "'true', 'false'";

  return query.whereRaw(
    `(json_type(data, ${arrayPath}) = 'array' and exists (` +
      `select 1 from json_each(json_extract(data, ${valuePath})) as item ` +
      `where item.type in (${type}) and item.value = ${value}` +
      '))'
  );
};

function stringOperator(
  build: (valueSql: string, operand: string, query: Query) => string
): SqlOperator<any> {
  return (condition: FieldNode<NormalizedStringMatch>, query: Query) => {
    const typePath = query.param(jsonPath(condition.field));
    const valuePath = query.param(jsonPath(condition.field));
    let valueSql = `json_extract(data, ${valuePath})`;
    let operand = condition.value.value;

    if (!condition.value.caseSensitive) {
      valueSql = `lower(${valueSql})`;
      operand = asciiLower(operand);
    }

    return query.whereRaw(
      `(json_type(data, ${typePath}) = 'text' and ` +
        `${build(valueSql, operand, query)})`
    );
  };
}

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) + 32)
  );
}

const interpretSqlite = createSqlInterpreter({
  and,
  or,
  nor,
  eq: scalarComparison('='),
  ne: scalarComparison('<>'),
  lt: scalarComparison('<'),
  lte: scalarComparison('<='),
  gt: scalarComparison('>'),
  gte: scalarComparison('>='),
  in: membership(false),
  nin: membership(true),
  contains,
  startsWith: stringOperator((value, operand, query) => {
    const lengthParameter = query.param(operand);
    const comparisonParameter = query.param(operand);
    return `substr(${value}, 1, length(${lengthParameter})) = ${comparisonParameter}`;
  }),
  containsText: stringOperator(
    (value, operand, query) => `instr(${value}, ${query.param(operand)}) > 0`
  ),
  endsWith: stringOperator((value, operand, query) => {
    if (operand === '') {
      return '1 = 1';
    }
    const lengthParameter = query.param(operand);
    const comparisonParameter = query.param(operand);
    return `substr(${value}, -length(${lengthParameter})) = ${comparisonParameter}`;
  }),
});

export interface CompiledSQLiteQuery {
  sql: string;
  params: unknown[];
}

export function compileSQLiteQuery(
  filter: LiveFilter<unknown>
): CompiledSQLiteQuery {
  const ast = createLiveFilterGuard(filter).ast;
  if (
    typeof ast === 'object' &&
    ast !== null &&
    (ast as { operator?: unknown }).operator === 'and' &&
    Array.isArray((ast as { value?: unknown }).value) &&
    (ast as { value: unknown[] }).value.length === 0
  ) {
    return { sql: '1 = 1', params: [] };
  }
  const [sql, params] = interpretSqlite(ast, sqlite);
  return { sql, params };
}
