/**
 * Worker 進入點（規劃書 16 章；模組 08、11、13、14、15、16、17）。
 *
 * 收到 SIGINT／SIGTERM 時停止領取新工作，等目前批次完成後才結束。
 */

import { createWorker } from './worker.ts';
import { readWorkerEnv } from './env.ts';

const controller = new AbortController();
let stopping = false;

function requestStop(signal: string): void {
  if (stopping) return;
  stopping = true;
  process.stdout.write(`收到 ${signal}，停止領取新工作，等待目前批次完成…\n`);
  controller.abort();
}

process.on('SIGINT', () => requestStop('SIGINT'));
process.on('SIGTERM', () => requestStop('SIGTERM'));

const env = readWorkerEnv();
const worker = createWorker({ env, signal: controller.signal });

try {
  await worker.run();
  process.stdout.write('worker 已停止。\n');
} catch (cause) {
  process.stderr.write(`${cause instanceof Error ? cause.message : 'worker 啟動失敗'}\n`);
  process.exitCode = 1;
}
