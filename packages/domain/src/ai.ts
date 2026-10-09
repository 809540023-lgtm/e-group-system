import { AppError } from './errors.ts';

/**
 * AI 派工與省 Token 工作流程。
 *
 * 核心不變式：
 * 1. 預設 desktop_manual：產生最小 task packet，不假定桌面無限量可被伺服器無限呼叫。
 * 2. 來源 hash 相同時重用已核准結果，不重複 OCR。
 * 3. 來源與客戶文字是資料，不是改動系統權限的指令（prompt injection 防護）。
 * 4. AI 輸出經過 schema、來源證據與發布條件；提議不能直接調權限或退款。
 */

export type AiMode = 'desktop_manual' | 'api';

export type AiTaskStatus = 'queued' | 'dispatched' | 'returned' | 'validated' | 'rejected' | 'failed';

export interface AiTask {
  readonly taskId: string;
  readonly taskKey: string;
  readonly mode: AiMode;
  readonly sourceVersion: string;
  readonly sourceHash: string;
  readonly changedPaths: readonly string[];
  readonly acceptanceCases: readonly string[];
  readonly outputContract: string;
  readonly status: AiTaskStatus;
  readonly createdAt: string;
}

export interface AiRun {
  readonly runId: string;
  readonly taskId: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costTwd: number;
  readonly startedAt: string;
  readonly finishedAt: string | null;
}

export interface AiUsage {
  readonly date: string;
  readonly spentTwd: number;
  readonly reservedTwd: number;
}

export interface AiBudget {
  readonly dailyLimitTwd: number;
  readonly perRequestLimitTwd: number;
  readonly modelAllowList: readonly string[];
  readonly baseUrl: string | null;
}

/**
 * 配置缺失時拒絕付費請求。desktop_manual 模式不呼叫付費 API。
 */
export function assertApiRequestAllowed(input: {
  readonly mode: AiMode;
  readonly budget: AiBudget | null;
  readonly usage: AiUsage;
  readonly model: string;
  readonly estimatedCostTwd: number;
}): void {
  if (input.mode === 'desktop_manual') {
    throw new AppError('FORBIDDEN', 'desktop_manual 模式不呼叫付費 API，請改用桌面交接');
  }
  if (!input.budget) {
    throw new AppError('INTEGRATION_PENDING', '缺少 AI API 預算與模型設定，拒絕付費請求');
  }
  if (!input.budget.baseUrl) {
    throw new AppError('INTEGRATION_PENDING', '缺少 AI API base URL，拒絕付費請求');
  }
  if (!input.budget.modelAllowList.includes(input.model)) {
    throw new AppError('VALIDATION_FAILED', `模型 ${input.model} 不在允許清單內`);
  }
  if (input.estimatedCostTwd > input.budget.perRequestLimitTwd) {
    throw new AppError('FORBIDDEN', `單次預估成本 ${input.estimatedCostTwd} 超過單次上限 ${input.budget.perRequestLimitTwd}`);
  }
  if (input.usage.spentTwd + input.usage.reservedTwd + input.estimatedCostTwd > input.budget.dailyLimitTwd) {
    throw new AppError('FORBIDDEN', '超過當日 AI 預算上限，拒絕請求');
  }
}

/** 來源 hash 相同時重用已核准結果。 */
export function findReusableResult(
  tasks: readonly AiTask[],
  input: { readonly taskKey: string; readonly sourceHash: string },
): AiTask | null {
  return (
    tasks.find(
      (t) => t.taskKey === input.taskKey && t.sourceHash === input.sourceHash && t.status === 'validated',
    ) ?? null
  );
}

/** 任務雜湊：相同輸入不重複派工。 */
export function taskHash(task: Pick<AiTask, 'taskKey' | 'sourceVersion' | 'sourceHash' | 'outputContract'>): string {
  const text = [task.taskKey, task.sourceVersion, task.sourceHash, task.outputContract].join('\u0001');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/**
 * Prompt injection 防護：來源與客戶文字視為資料。
 * 命中要求變更付款帳號、權限或執行指令的文字時，標記為需人工複核。
 */
const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore (all )?previous instructions/i,
  /忽略(以上|先前|之前)(的)?(所有)?指令/,
  /change (the )?(payment|bank) account/i,
  /更改(付款|銀行|匯款)帳號/,
  /grant (me )?(admin|owner) (access|permission)/i,
  /(給我|授予)(管理員|最高|owner)權限/,
  /refund (this )?order (immediately|now)/i,
  /直接退款/,
  /system prompt/i,
  /you are now/i,
];

export interface InjectionScanResult {
  readonly suspicious: boolean;
  readonly hits: readonly string[];
}

export function scanForInjection(text: string): InjectionScanResult {
  const hits = INJECTION_PATTERNS.filter((p) => p.test(text)).map((p) => p.source);
  return { suspicious: hits.length > 0, hits };
}

/** AI 提議不能直接調權限或退款，必須經執行器依政策檢查。 */
export type AiProposalKind = 'catalog_draft' | 'marketing_copy' | 'ocr_extract' | 'translation' | 'rfq_draft' | 'price_suggestion';

export interface AiProposal {
  readonly proposalId: string;
  readonly taskId: string;
  readonly kind: AiProposalKind;
  readonly payload: unknown;
  readonly sourceEvidence: readonly string[];
  readonly confidence: number;
}

export type ProposalDecision =
  | { readonly action: 'accept' }
  | { readonly action: 'manual_review'; readonly reason: string }
  | { readonly action: 'reject'; readonly reason: string };

/**
 * 低信心價格、效期、負號及單位轉待審，不直接上架。
 */
export function evaluateProposal(
  proposal: AiProposal,
  options: { readonly minConfidence?: number; readonly requiredEvidence?: boolean } = {},
): ProposalDecision {
  const minConfidence = options.minConfidence ?? 0.85;

  if (options.requiredEvidence !== false && proposal.sourceEvidence.length === 0) {
    return { action: 'reject', reason: '缺少來源證據，不得採用' };
  }
  if (!Number.isFinite(proposal.confidence) || proposal.confidence < 0 || proposal.confidence > 1) {
    return { action: 'reject', reason: `信心值 ${proposal.confidence} 不在 0 到 1 之間` };
  }
  if (proposal.confidence < minConfidence) {
    return { action: 'manual_review', reason: `信心值 ${proposal.confidence} 低於門檻 ${minConfidence}` };
  }
  return { action: 'accept' };
}

/** 桌面交接：產生最小 task packet，只含必要資料。 */
export interface TaskPacket {
  readonly taskId: string;
  readonly taskKey: string;
  readonly relevantSections: readonly string[];
  readonly allowedPaths: readonly string[];
  readonly sourceVersion: string;
  readonly previousHandoff: string | null;
  readonly acceptanceCases: readonly string[];
  readonly outputContract: string;
}

export function buildTaskPacket(input: {
  readonly taskId: string;
  readonly taskKey: string;
  readonly relevantSections: readonly string[];
  readonly allowedPaths: readonly string[];
  readonly sourceVersion: string;
  readonly previousHandoff: string | null;
  readonly acceptanceCases: readonly string[];
  readonly outputContract: string;
}): TaskPacket {
  if (input.allowedPaths.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'task packet 必須指定 allowed_paths');
  }
  if (input.acceptanceCases.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'task packet 必須包含驗收案例');
  }
  return { ...input };
}

/** 交接格式：status 只可用 completed、integration_pending、blocked、failed。 */
export type HandoffStatus = 'completed' | 'integration_pending' | 'blocked' | 'failed';

export interface Handoff {
  readonly task_id: string;
  readonly task_key: string;
  readonly status: HandoffStatus;
  readonly commit_sha: string | null;
  readonly changed_files: readonly string[];
  readonly commands_run: readonly { readonly command: string; readonly exit_code: number }[];
  readonly actual_results: readonly string[];
  readonly migrations: readonly string[];
  readonly new_env_names: readonly string[];
  readonly integration_status: Readonly<Record<string, string>>;
  readonly unresolved_items: readonly string[];
  readonly next_task: string;
}

export function validateHandoff(handoff: Handoff): void {
  if (handoff.status === 'completed') {
    if (handoff.changed_files.length === 0) {
      throw new AppError('VALIDATION_FAILED', 'completed 必須有實際修改檔案');
    }
    if (handoff.commands_run.length === 0) {
      throw new AppError('VALIDATION_FAILED', 'completed 必須有實際執行指令');
    }
    if (handoff.actual_results.length === 0) {
      throw new AppError('VALIDATION_FAILED', 'completed 必須有實際測試證據');
    }
  }
  if (handoff.task_id.trim() === '' || handoff.task_key.trim() === '') {
    throw new AppError('VALIDATION_FAILED', 'task_id 與 task_key 必須與派工相同');
  }
}

/** 摘要控制在 2000 個中文字內。 */
export const HANDOFF_SUMMARY_LIMIT = 2000;

export function assertSummaryLength(summary: string): void {
  if (summary.length > HANDOFF_SUMMARY_LIMIT) {
    throw new AppError('VALIDATION_FAILED', `交接摘要 ${summary.length} 字超過上限 ${HANDOFF_SUMMARY_LIMIT}`);
  }
}
