/**
 * Outbox 處理器（規劃書 08、11、13、14、15、16、17 章）。
 *
 * 每個處理器都必須冪等：同一工作重複執行不得產生第二次外部副作用。
 * 未設定外部憑證時回傳 integration_pending，不以假成功掩蓋。
 */

import { buildCustomerOrderNotification, buildStaffNotification, createLineAdapter } from '@jp/integrations/line';
import { createShippingAdapter } from '@jp/integrations/shipping';
import { createMetaAdapter } from '@jp/integrations/meta';
import { createOpenAiAdsAdapter } from '@jp/integrations/openai-ads';
import { createAiAdapter, renderTaskPacketForDesktop } from '@jp/integrations/ai';
import { createGoogleSourceAdapter } from '@jp/integrations/google';
import { done, fail, fromAdapter, pending, type HandlerContext, type HandlerOutcome, type OutboxHandler, type OutboxJob } from '../outbox.ts';

function str(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
}

function num(payload: Record<string, unknown>, key: string, fallback: number): number {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function strList(payload: Record<string, unknown>, key: string): readonly string[] {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function publicBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
}

/** 員工通知：只含訂單碼、待辦種類、嚴重度、負責角色與後臺連結。 */
export const lineNotifyStaff: OutboxHandler = async (job: OutboxJob): Promise<HandlerOutcome> => {
  const adapter = createLineAdapter();
  if (adapter.capability().status !== 'ready') {
    return pending('尚未設定 LINE 憑證，員工通知未送出。');
  }
  const to = str(job.payload, 'staffGroupId');
  if (to === '') return fail('缺少 staffGroupId。');

  const message = buildStaffNotification({
    orderCode: str(job.payload, 'orderCode'),
    role: str(job.payload, 'role'),
    taskSummary: str(job.payload, 'taskSummary'),
    adminPath: str(job.payload, 'adminPath'),
    publicBaseUrl: publicBaseUrl(),
  });
  return fromAdapter(await adapter.pushMessage(to, [message]), '員工通知已送出。');
};

/** 顧客通知：只含訂單碼與狀態，不含內部成本或員工資訊。 */
export const lineNotifyCustomer: OutboxHandler = async (job: OutboxJob): Promise<HandlerOutcome> => {
  const adapter = createLineAdapter();
  if (adapter.capability().status !== 'ready') {
    return pending('尚未設定 LINE 憑證，顧客通知未送出。');
  }
  const to = str(job.payload, 'lineUserId');
  if (to === '') return fail('缺少 lineUserId。');

  const orderCode = str(job.payload, 'orderCode');
  const message = buildCustomerOrderNotification({
    orderCode,
    statusText: str(job.payload, 'statusText'),
    orderPath: `/orders?orderCode=${encodeURIComponent(orderCode)}`,
    publicBaseUrl: publicBaseUrl(),
  });
  return fromAdapter(await adapter.pushMessage(to, [message]), '顧客通知已送出。');
};

/** 物流狀態更新：以事件方式附加，保留完整歷程。 */
export const shipmentTracking: OutboxHandler = async (job: OutboxJob): Promise<HandlerOutcome> => {
  const adapter = createShippingAdapter();
  if (adapter.capability().status !== 'ready') {
    return pending('尚未設定物流憑證，物流狀態未更新。');
  }
  const trackingNo = str(job.payload, 'trackingNo');
  if (trackingNo === '') return fail('缺少 trackingNo。');
  return fromAdapter(await adapter.fetchTracking(trackingNo), '物流狀態已更新。');
};

/** 廣告成效：平台歸因與實際營收分開，不混用。 */
export const adsMetricsPull: OutboxHandler = async (job: OutboxJob): Promise<HandlerOutcome> => {
  const platform = str(job.payload, 'platform');
  const since = str(job.payload, 'since');
  const until = str(job.payload, 'until');
  if (since === '' || until === '') return fail('缺少 since 或 until。');

  if (platform === 'meta') {
    const adapter = createMetaAdapter();
    if (adapter.capability().status !== 'ready') {
      return pending('尚未設定 Meta 憑證，廣告成效未取得。');
    }
    return fromAdapter(await adapter.fetchInsights({ since, until }), '廣告成效已取得。');
  }
  if (platform === 'openai_ads') {
    const adapter = createOpenAiAdsAdapter();
    if (adapter.capability().status !== 'ready') {
      return pending('尚未設定 OpenAI Ads 憑證，廣告成效未取得。');
    }
    return fromAdapter(await adapter.fetchInsights({ since, until }), '廣告成效已取得。');
  }
  return fail(`不支援的廣告平台 ${platform}。`);
};

/** 廣告草稿一律先建立為暫停狀態，需人工核准才啟用。 */
export const adsDraftCreate: OutboxHandler = async (job: OutboxJob): Promise<HandlerOutcome> => {
  const platform = str(job.payload, 'platform');
  const idempotencyKey = str(job.payload, 'idempotencyKey');
  if (idempotencyKey === '') return fail('缺少 idempotencyKey。');

  if (platform === 'meta') {
    const adapter = createMetaAdapter();
    if (adapter.capability().status !== 'ready') {
      return pending('尚未設定 Meta 憑證，廣告草稿未建立。');
    }
    return fromAdapter(
      await adapter.createPausedDraft(
        {
          internalCampaignId: str(job.payload, 'internalCampaignId'),
          name: str(job.payload, 'name'),
          objective: str(job.payload, 'objective'),
          dailyBudgetMicros: num(job.payload, 'dailyBudgetMicros', 0),
          currency: str(job.payload, 'currency') || 'TWD',
          placements: ['facebook', 'instagram'],
          creativeIds: strList(job.payload, 'creativeIds'),
          status: 'PAUSED',
        },
        idempotencyKey,
      ),
      'Meta 廣告草稿已建立為暫停狀態，需人工核准才啟用。',
    );
  }
  if (platform === 'openai_ads') {
    const adapter = createOpenAiAdsAdapter();
    if (adapter.capability().status !== 'ready') {
      return pending('尚未設定 OpenAI Ads 憑證，廣告草稿未建立。');
    }
    return fromAdapter(
      await adapter.createPausedDraft(
        {
          internalCampaignId: str(job.payload, 'internalCampaignId'),
          name: str(job.payload, 'name'),
          objective: str(job.payload, 'objective'),
          dailyBudgetMicros: num(job.payload, 'dailyBudgetMicros', 0),
          currency: str(job.payload, 'currency') || 'TWD',
          status: 'paused',
        },
        idempotencyKey,
      ),
      'OpenAI Ads 廣告草稿已建立為暫停狀態，需人工核准才啟用。',
    );
  }
  return fail(`不支援的廣告平台 ${platform}。`);
};

/**
 * AI 任務派送。
 * 預設 desktop_manual：只產生任務包，由桌面 Grok bot 執行，不呼叫外部 API。
 */
export const aiTaskDispatch: OutboxHandler = async (job: OutboxJob, context: HandlerContext): Promise<HandlerOutcome> => {
  const adapter = createAiAdapter();
  const mode = adapter.mode();

  if (mode === 'desktop_manual') {
    const packet = renderTaskPacketForDesktop({
      taskKey: str(job.payload, 'taskKey'),
      instructions: str(job.payload, 'instructions'),
      inputPayload: str(job.payload, 'inputPayload'),
      outputContract: str(job.payload, 'outputContract'),
      acceptanceCases: Array.isArray(job.payload.acceptanceCases)
        ? (job.payload.acceptanceCases as unknown[]).filter((c): c is string => typeof c === 'string')
        : [],
    });
    context.log(`AI 任務 ${str(job.payload, 'taskKey')} 已產生桌面任務包，等待人工執行。`);
    context.log(packet);
    return done('已產生桌面任務包；未呼叫外部 AI API。');
  }

  if (adapter.capability().status !== 'ready') {
    return pending('尚未設定 AI API 憑證，任務未派送。');
  }

  const budget = {
    dailyLimitTwd: num(job.payload, 'dailyLimitTwd', 0),
    perRequestLimitTwd: num(job.payload, 'perRequestLimitTwd', 0),
    modelAllowList: Array.isArray(job.payload.modelAllowList)
      ? (job.payload.modelAllowList as unknown[]).filter((m): m is string => typeof m === 'string')
      : [],
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? null,
  };
  const usage = {
    date: str(job.payload, 'date'),
    spentTwd: num(job.payload, 'spentTwd', 0),
    reservedTwd: num(job.payload, 'reservedTwd', 0),
  };
  const request = {
    model: str(job.payload, 'model'),
    systemPrompt: str(job.payload, 'systemPrompt'),
    userContent: str(job.payload, 'inputPayload'),
    maxOutputTokens: num(job.payload, 'maxOutputTokens', 1024),
    timeoutMs: num(job.payload, 'timeoutMs', 30_000),
    estimatedCostTwd: num(job.payload, 'estimatedCostTwd', 0),
  };

  const allowed = adapter.assertAllowed(request, budget, usage);
  if (!allowed.ok) return fromAdapter(allowed, '');
  return fromAdapter(await adapter.complete(request, budget, usage), 'AI 任務已完成。');
};

/** 商品同步：讀取 ApprovedCatalog 並產生差異，不直接發布。 */
export const catalogSync: OutboxHandler = async (job: OutboxJob): Promise<HandlerOutcome> => {
  const adapter = createGoogleSourceAdapter();
  if (adapter.capability().status !== 'ready') {
    return pending('尚未設定 Google 憑證，商品同步未執行。');
  }
  const spreadsheetId = str(job.payload, 'spreadsheetId');
  const range = str(job.payload, 'range');
  if (spreadsheetId === '' || range === '') {
    return fail('缺少 spreadsheetId 或 range。');
  }
  return fromAdapter(await adapter.readApprovedCatalog({ spreadsheetId, range }), '已讀取 ApprovedCatalog，等待人工確認後發布。');
};

/** 每日對帳：金流與銀行紀錄比對，差異需人工核對。 */
export const reconcileDaily: OutboxHandler = async (job: OutboxJob): Promise<HandlerOutcome> => {
  const date = str(job.payload, 'date');
  if (date === '') return fail('缺少對帳日期。');
  return pending(`對帳 ${date} 需要金流與銀行匯入檔，尚未設定來源。`);
};

/** 員工每日工作摘要：只含待辦數量與角色，不含客戶個資。 */
export const staffSummary: OutboxHandler = async (job: OutboxJob): Promise<HandlerOutcome> => {
  const date = str(job.payload, 'date');
  if (date === '') return fail('缺少摘要日期。');
  return pending(`員工摘要 ${date} 需要資料庫統計，尚未連線。`);
};

/** 付款確認：庫存與訂單狀態已由 jp_apply_payment_event 在同一交易完成。 */
export const paymentConfirmed: OutboxHandler = async (job: OutboxJob): Promise<HandlerOutcome> => {
  const orderCode = str(job.payload, 'orderCode');
  if (orderCode === '') return fail('缺少 orderCode。');
  return done('付款事件已於交易中套用；此工作僅負責後續通知。');
};

export const paymentRefund: OutboxHandler = async (job: OutboxJob): Promise<HandlerOutcome> => {
  const requestKey = str(job.payload, 'requestKey');
  if (requestKey === '') return fail('缺少 requestKey。');
  return done('退款已於交易中完成；此工作僅負責後續通知。');
};

/** 預設處理器表；未列出的 topic 會回報 integration_pending。 */
export function defaultHandlers(): ReadonlyMap<string, OutboxHandler> {
  return new Map<string, OutboxHandler>([
    ['catalog.sync', catalogSync],
    ['payment.confirmed', paymentConfirmed],
    ['payment.refund', paymentRefund],
    ['line.notify.staff', lineNotifyStaff],
    ['line.notify.customer', lineNotifyCustomer],
    ['shipment.tracking', shipmentTracking],
    ['ads.metrics.pull', adsMetricsPull],
    ['ads.draft.create', adsDraftCreate],
    ['ai.task.dispatch', aiTaskDispatch],
    ['staff.summary', staffSummary],
    ['reconcile.daily', reconcileDaily],
  ]);
}
