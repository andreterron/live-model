import { operationMessagesSchema } from 'live-model';
import type { BackendLiveModel } from 'live-model';

export function createOperationsHandler(liveModel: BackendLiveModel) {
  return async function handleOperations(request: Request): Promise<Response> {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = operationMessagesSchema.safeParse(body);

    // TODO: Use zod error for error message
    if (!parsed.success) {
      return Response.json(
        { error: 'Body must be an array of valid protocol operation messages' },
        { status: 400 }
      );
    }

    return Response.json(
      parsed.data.map(({ key, operation }) =>
        liveModel.processOperation(key, operation)
      )
    );
  };
}
