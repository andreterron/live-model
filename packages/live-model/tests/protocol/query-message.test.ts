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
        from: 'tasks',
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
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
        query: {},
      }).success
    ).toBe(false);
    expect(
      queryMessageSchema.safeParse({
        type: 'query',
        queryId: 'recent-tasks',
        data_source: 'entities',
      }).success
    ).toBe(false);
  });
});
