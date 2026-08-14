import { StorageAdapter } from '../creators/storage-live.js';

/**
 * This class will manage all operations for a single client. It can also have
 * a remote transport registered to sync operations between clients.
 *
 * It will:
 * - Store operations on some kind of storage, using an adapter
 * - Forward operations to a remote client, if one is registered
 */
export class OperationsClient {
  constructor(private store: OperationsStore, remoteTransport: any) {}
}

// TODO
export interface OperationsStore {
  get(key: string): any;
}
