import { operationsSchema } from '@live-model/protocol';
import { executeOperation } from './operations.js';
import type { StorageAdapter } from './storage-adapter/storage-adapter.js';

export function createOperationsHandler(storage: StorageAdapter) {
  return async function handleOperations(request: Request): Promise<Response> {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = operationsSchema.safeParse(body);

    // TODO: Use zod error for error message
    if (!parsed.success) {
      return Response.json(
        { error: 'Body must be an array of valid protocol operations' },
        { status: 400 }
      );
    }

    return Response.json(
      parsed.data.map((operation) => executeOperation(storage, operation))
    );
  };
}
