import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { databaseUrl } from '../src/lib/env.ts';

const dir = fileURLToPath(new URL('../db/migrations', import.meta.url));
const connectionString = databaseUrl();

const client = new Client({ connectionString });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      checksum   text NOT NULL
    )
  `);

  const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  const applied = await client.query<{ version: string; checksum: string }>('SELECT version, checksum FROM schema_migrations');
  const appliedMap = new Map(applied.rows.map((row) => [row.version, row.checksum]));

  for (const name of files) {
    const version = name.replace(/\.sql$/, '');
    const sql = await readFile(join(dir, name), 'utf8');
    const checksum = createHash('sha256').update(sql, 'utf8').digest('hex');
    const previous = appliedMap.get(version);

    if (previous !== undefined) {
      if (previous !== checksum) {
        throw new Error(`MIGRATION_CHECKSUM_MISMATCH: ${version} 已套用但內容被修改。請新增版本，不要改舊版。`);
      }
      console.log(`跳過 ${version}（已套用）`);
      continue;
    }

    console.log(`套用 ${version}`);
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)', [version, checksum]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  console.log('migration 完成。');
} finally {
  await client.end();
}
