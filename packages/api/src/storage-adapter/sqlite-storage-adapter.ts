import type { LiveStateLike } from '@live-model/protocol';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { StorageAdapter } from './storage-adapter.js';

export class SQLiteStorageAdapter implements StorageAdapter {
  private readonly database: DatabaseSync;
  private readonly selectEntity: StatementSync;
  private readonly selectKeys: StatementSync;
  private readonly upsertEntity: StatementSync;
  private readonly deleteEntity: StatementSync;

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath);

    this.database.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);

    this.selectEntity = this.database.prepare(
      'SELECT data FROM entities WHERE key = ?'
    );
    // Temporary explorer support. The final API will not expose key listing,
    // so this intentionally uses a simple full-table key scan.
    this.selectKeys = this.database.prepare(
      'SELECT key FROM entities ORDER BY key'
    );
    this.upsertEntity = this.database.prepare(`
      INSERT INTO entities (key, data)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET data = excluded.data
    `);
    this.deleteEntity = this.database.prepare(
      'DELETE FROM entities WHERE key = ?'
    );
  }

  get(key: string): LiveStateLike {
    const row = this.selectEntity.get(key);

    if (!row) {
      return { kind: 'absent', reason: 'not_found' };
    }

    return {
      kind: 'value',
      value: JSON.parse((row as { data: string }).data),
    };
  }

  listKeys(): string[] {
    return this.selectKeys.all().map((row) => row.key as string);
  }

  set(key: string, value: unknown): boolean {
    const data = JSON.stringify(value);

    if (data === undefined) {
      return false;
    }

    this.upsertEntity.run(key, data);
    return true;
  }

  delete(key: string): boolean {
    this.deleteEntity.run(key);
    return true;
  }
}
