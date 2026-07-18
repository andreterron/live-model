import type { LiveStateLike } from '@live-model/protocol';

export interface StorageAdapter {
  get(key: string): LiveStateLike;
  listKeys(): string[];
  set(key: string, data: unknown): boolean;
  delete(key: string): boolean;
}
