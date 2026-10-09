/**
 * 交易一致性 smoke CLI（模組 02）。
 *
 * 用法：node --experimental-strip-types packages/db/src/cli/smoke.ts
 * 需要 DATABASE_URL；未設定時明確回報 SKIPPED。
 */

import { main } from '../smoke.ts';

await main();
