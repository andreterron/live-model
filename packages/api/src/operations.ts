import {
  allKeysKey,
  type AnyOperation,
  type OperationStatusMessage,
} from '@live-model/protocol';
import type { StorageAdapter } from './storage-adapter/storage-adapter.js';

export function executeOperation(
  storage: StorageAdapter,
  operation: AnyOperation
): OperationStatusMessage {
  // TODO: Review what should happen when `delete` targets a deleted or missing key
  const persisted =
    operation.key !== allKeysKey &&
    (operation.type === 'delete'
      ? storage.delete(operation.key)
      : storage.set(operation.key, operation.data));

  if (!persisted) {
    return {
      type: 'op_status',
      status: 'error',
      error: {
        code: 'operation_failed',
        message: 'Operation could not be persisted',
      },
    };
  }

  return {
    type: 'op_status',
    status: 'success',
  };
}
