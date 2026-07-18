import { allKeysKey } from '@live-model/protocol';
import { createOperationsHandler } from '../src/operations-request-handler.js';
import type { StorageAdapter } from '../src/storage-adapter/storage-adapter.js';

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
    const handler = createOperationsHandler(createStorage());
    const response = await handler(
      new Request('http://localhost/operations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([
          { type: 'set_value', key: 'foo', data: { count: 1 } },
          { type: 'delete', key: 'foo' },
          { type: 'delete', key: allKeysKey },
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
          message: 'Operation could not be persisted',
        },
      },
    ]);
  });

  test('rejects invalid JSON and non-operation arrays', async () => {
    const handler = createOperationsHandler(createStorage());
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
