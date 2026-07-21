import { describe, expect, it } from 'vitest';

import { formatJson, parseJson } from './explorer-values.js';
import {
  ExplorerEntryPage,
  ExplorerIndexPage,
  ExplorerLayout,
} from '../index.js';

describe('Explorer JSON values', () => {
  it('formats JSON-compatible values', () => {
    expect(formatJson({ nested: [true, 1] })).toBe(
      '{\n  "nested": [\n    true,\n    1\n  ]\n}'
    );
  });

  it('reports invalid JSON without throwing', () => {
    const result = parseJson('{');
    expect(result.status).toBe('invalid');
  });
});

describe('component exports', () => {
  it('exposes the page component API', () => {
    expect(ExplorerLayout).toBeTypeOf('function');
    expect(ExplorerIndexPage).toBeTypeOf('function');
    expect(ExplorerEntryPage).toBeTypeOf('function');
  });
});
