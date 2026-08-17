import {
  protocolMessageSchema,
  queryMessageSchema,
} from '../../src/protocol.js';

describe('query messages', () => {
  test('accepts an opaque query and its subscription ID', () => {
    const message = {
      type: 'query',
      queryId: 'recent-tasks',
      data_source: 'entities',
      query: {
        filter: {
          from: 'tasks',
          orderBy: [{ field: 'createdAt', direction: 'desc' }],
        },
        limit: 20,
      },
    };

    expect(queryMessageSchema.parse(message)).toEqual(message);
    expect(protocolMessageSchema.parse(message)).toEqual(message);
  });

  test('requires a query ID and query payload', () => {
    expect(
      queryMessageSchema.safeParse({
        type: 'query',
        data_source: 'entities',
        query: { filter: {} },
      }).success
    ).toBe(false);
    expect(
      queryMessageSchema.safeParse({
        type: 'query',
        queryId: 'recent-tasks',
        data_source: 'entities',
      }).success
    ).toBe(false);
    expect(
      queryMessageSchema.safeParse({
        type: 'query',
        queryId: 'recent-tasks',
        data_source: 'entities',
        query: 'not-an-object',
      }).success
    ).toBe(false);
  });

  test('accepts query limits for server-side normalization', () => {
    const message = {
      type: 'query',
      queryId: 'limited',
      data_source: 'entities',
      query: { filter: {}, limit: 20_000 },
    };

    expect(queryMessageSchema.parse(message)).toEqual(message);
    expect(
      queryMessageSchema.safeParse({
        ...message,
        query: { filter: {}, limit: -1 },
      }).success
    ).toBe(false);
  });
});
