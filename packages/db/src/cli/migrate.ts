/**
 * migration CLI（模組 02、18）。
 *
 * 用法：
 *   node --experimental-strip-types packages/db/src/cli/migrate.ts [--dry-run] [--rollback-to <version>]
 *
 * 需要 DATABASE_URL（管理連線，僅供 migration 使用，不得給公開 API）。
 */

import { Client } from 'pg';
import { describeRollback, migrate, readAppliedMigrations } from '../migrate.ts';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const rollbackIndex = args.indexOf('--rollback-to');
  const rollbackTo = rollbackIndex >= 0 ? args[rollbackIndex + 1] : undefined;

  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') {
    console.error('缺少 DATABASE_URL。migration 需要管理連線，請勿使用公開 API 的角色。');
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    if (rollbackTo !== undefined) {
      const applied = await readAppliedMigrations(client);
      const plan = describeRollback(applied, rollbackTo);
      console.log(`目前版本：${plan.current ?? '（無）'}`);
      console.log(`目標版本：${plan.target}`);
      if (plan.steps.length === 0) {
        console.log('無需回復。');
        return;
      }
      console.log(`需回復步驟：${plan.steps.join('、')}`);
      console.log('本工具不自動逆轉金融紀錄；請依規劃書 19 章以備份還原流程處理。');
      return;
    }

    const result = await migrate(client, { dryRun, log: (m) => console.log(m) });
    if (result.dryRun) {
      console.log(`dry-run 完成：待套用 ${result.pendingCount} 版，已套用 ${result.skipped.length} 版。`);
    } else {
      console.log(`完成：本次套用 ${result.applied.length} 版，已存在 ${result.skipped.length} 版。`);
    }
  } finally {
    await client.end();
  }
}

await main();
