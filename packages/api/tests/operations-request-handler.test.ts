import { allKeysKey } from '@live-model/protocol';
import { BackendLiveModel } from 'live-model';
import type { StorageAdapter } from 'live-model';
import { createOperationsHandler } from '../src/operations-request-handler.js';

function createStorage(initialValues: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(initialValues));
  const storage: StorageAdapter = {
    get(key) {
      return values.has(key)
        ? { kind: 'value', value: values.get(key) }
        : { kind: 'absent', reason: 'not_found' };
    },
    listKeys() {
      return [...values.keys()].sort();
    },
    set(key, data) {
      values.set(key, data);
      return true;
    },
    delete(key) {
      values.delete(key);
      return true;
    },
  };
  return storage;
}

describe('createOperationsHandler', () => {
  test('processes operations in order and returns a result for each one', async () => {
    const handler = createOperationsHandler(
      new BackendLiveModel(createStorage())
    );
    const response = await handler(
      new Request('http://localhost/operations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([
          {
            type: 'op',
            key: 'foo',
            operation: { type: 'set_value', data: { count: 1 } },
          },
          { type: 'op', key: 'foo', operation: { type: 'delete' } },
          {
            type: 'op',
            key: allKeysKey,
            operation: { type: 'delete' },
          },
        ]),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        type: 'op_status',
        status: 'success',
      },
      {
        type: 'op_status',
        status: 'success',
      },
      {
        type: 'op_status',
        status: 'error',
        error: {
          code: 'operation_failed',
          message: `The reserved key "${allKeysKey}" is read-only`,
        },
      },
    ]);
  });

  test('rejects invalid JSON and non-operation arrays', async () => {
    const handler = createOperationsHandler(
      new BackendLiveModel(createStorage())
    );
    const invalidJson = await handler(
      new Request('http://localhost/operations', {
        method: 'POST',
        body: '{',
      })
    );
    const invalidOperations = await handler(
      new Request('http://localhost/operations', {
        method: 'POST',
        body: JSON.stringify({ type: 'read', key: 'foo' }),
      })
    );

    expect(invalidJson.status).toBe(400);
    expect(invalidOperations.status).toBe(400);
  });
});
