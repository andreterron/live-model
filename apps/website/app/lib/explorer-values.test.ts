import { describe, expect, test } from 'vitest';

import { formatJson, parseJson } from './explorer-values';

describe('explorer JSON values', () => {
  test.each([
    ['object', '{}'],
    ['array', '[]'],
    ['string', '"value"'],
    ['number', '1'],
    ['boolean', 'true'],
    ['null', 'null'],
  ])('parses a JSON %s', (_type, input) => {
    const result = parseJson(input);

    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(formatJson(result.value)).not.toBeNull();
    }
  });

  test('returns a useful invalid JSON result', () => {
    const result = parseJson('{');

    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.error).not.toBe('');
    }
  });
});
