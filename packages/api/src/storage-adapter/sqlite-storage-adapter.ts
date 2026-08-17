import {
  allKeysKey,
  compileSQLiteQuery,
  type LiveMetadata,
  type LiveState,
  type NormalizedLiveQuery,
  type StorageAdapter,
  type StorageQueryResult,
} from 'live-model';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

export class SQLiteStorageAdapter implements StorageAdapter {
  private readonly database: DatabaseSync;
  private readonly selectEntity: StatementSync;
  private readonly selectKeys: StatementSync;
  private readonly upsertEntity: StatementSync;
  private readonly updateMetadata: StatementSync;
  private readonly deleteEntity: StatementSync;

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath);

    this.database.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      )
    `);

    const columns = this.database.prepare('PRAGMA table_info(entities)').all();
    if (!columns.some((column) => column.name === 'metadata')) {
      this.database.exec(
        `ALTER TABLE entities ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'`
      );
    }

    this.selectEntity = this.database.prepare(
      'SELECT data, metadata FROM entities WHERE key = ?'
    );
    // Temporary explorer support. The final API will not expose key listing,
    // so this intentionally uses a simple full-table key scan.
    this.selectKeys = this.database.prepare(
      'SELECT key FROM entities ORDER BY key'
    );
    this.upsertEntity = this.database.prepare(`
      INSERT INTO entities (key, data, metadata)
      VALUES (?, ?, '{}')
      ON CONFLICT(key) DO UPDATE SET data = excluded.data
    `);
    this.updateMetadata = this.database.prepare(
      'UPDATE entities SET metadata = ? WHERE key = ?'
    );
    this.deleteEntity = this.database.prepare(
      'DELETE FROM entities WHERE key = ?'
    );
  }

  get(key: string): LiveState<unknown> {
    const row = this.selectEntity.get(key);

    if (!row) {
      return { kind: 'absent', reason: 'not_found' };
    }

    const entity = row as { data: string; metadata: string };
    return {
      kind: 'value',
      value: JSON.parse(entity.data),
      metadata: JSON.parse(entity.metadata),
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

  setMetadata(key: string, metadata: LiveMetadata): boolean {
    const serialized = JSON.stringify(metadata);
    if (serialized === undefined) {
      return false;
    }

    return this.updateMetadata.run(serialized, key).changes > 0;
  }

  delete(key: string): boolean {
    this.deleteEntity.run(key);
    return true;
  }

  queryKeys(query: NormalizedLiveQuery<unknown>): StorageQueryResult {
    const compiled = compileSQLiteQuery(query.filter);
    const statement = this.database.prepare(
      `SELECT key FROM entities ` +
        `WHERE key <> ? AND (${compiled.sql}) ` +
        `ORDER BY key LIMIT ?`
    );
    const rows = statement.all(
      allKeysKey,
      ...(compiled.params as Array<string | number | null | Uint8Array>),
      query.limit + 1
    );
    const hasMore = rows.length > query.limit;

    return {
      keys: rows.slice(0, query.limit).map((row) => row.key as string),
      hasMore,
    };
  }
}
