import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { databaseUrl } from './env.ts';

const globalForDb = globalThis as unknown as { egPool?: Pool };

export function getPool(): Pool {
  if (globalForDb.egPool === undefined) {
    globalForDb.egPool = new Pool({ connectionString: databaseUrl(), max: 10 });
  }
  return globalForDb.egPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params as unknown[]);
  return result.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** 從 PostgreSQL 例外訊息取出可讀的錯誤碼（例如 OUT_OF_STOCK:SKU-1）。 */
export function dbErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const match = /^([A-Z_]+)(?::(.*))?$/.exec(error.message);
    if (match) {
      const code = match[1] ?? '';
      const detail = match[2] ?? '';
      const messages: Record<string, string> = {
        ORDER_EMPTY: '購物車為空。',
        STATION_UNAVAILABLE: '取貨站點目前未開放。',
        PRODUCT_NOT_FOUND: '找不到商品。',
        PRODUCT_NOT_ACTIVE: '商品已下架或停賣。',
        RECALL_BLOCKED: '商品或批次召回中，停止銷售與交付。',
        OUT_OF_STOCK: '庫存不足，請重新選擇數量。',
        ORDER_NOT_FOUND: '找不到訂單。',
        ORDER_NOT_PAYABLE: '訂單目前不可付款。',
        ORDER_NOT_DELIVERABLE: '訂單目前不可交付。',
        PICKUP_CODE_USED: '取貨碼已使用，不可重複核銷。',
        PICKUP_CODE_EXPIRED: '取貨碼已過期。',
        PICKUP_CODE_INVALID: '取貨碼不正確。',
        ORDER_NOT_REFUNDABLE: '訂單目前不可退款。',
        REFUND_EXCEEDS_PAID: '退款金額超過可退餘額。',
        BATCH_NOT_FOUND: '找不到批次。',
        RECALL_NOT_FOUND: '找不到召回紀錄。',
        RECALL_NOTIFICATIONS_PENDING: '仍有顧客通知未完成，不能結案。',
        SHIPMENT_NOT_FOUND: '找不到出貨單。',
        SHIPMENT_NOT_IN_TRANSIT: '出貨單狀態不是運送中。',
        REFERRAL_CODE_NOT_FOUND: '推薦碼不存在。',
        SELF_REFERRAL: '不可使用自己的推薦碼。',
        REFEREE_ALREADY_ATTRIBUTED: '此會員已有推薦歸因。',
        REFERRAL_NOT_FOUND: '找不到推薦紀錄。',
        REFERRAL_NOT_PENDING: '推薦紀錄不是待審狀態。',
        REFERRAL_NOT_APPROVED: '推薦紀錄不是已核准狀態。',
        REFERRAL_ORDER_NOT_DELIVERED: '訂單尚未完成交付，不能核准推薦獎勵。',
        REFERRAL_ORDER_REFUNDED: '訂單已退款，不能核准推薦獎勵。',
        SETTLEMENT_DUPLICATE: '訂單已結算，不得重複計酬。',
        EMAIL_TAKEN: '此電子郵件已有帳號。',
        CUSTOMER_CREATE_FAILED: '會員建立失敗。',
        ACCOUNT_CREATE_FAILED: '帳號建立失敗。',
        ORDER_CREATE_FAILED: '訂單建立失敗。',
        REFUND_AMOUNT_INVALID: '退款金額必須大於 0。',
        REFUND_REASON_REQUIRED: '請填寫退款原因。',
        NAME_REQUIRED: '請填寫姓名。',
        PRODUCT_FIELDS_REQUIRED: '請填寫 SKU、品名與分類。',
        PRODUCT_WEIGHT_SHELF_LIFE_REQUIRED: '重量與保存天數必須大於 0。',
        PRODUCT_STORAGE_INVALID: '保存方式不正確。',
        LABEL_BLOCKED: '營養標示或宣稱未通過檢核。',
        SUPPLIER_REQUIRED: '找不到供應商。',
        BATCH_FIELDS_REQUIRED: '請填寫 SKU、批號、生產日與到期日。',
        BATCH_QUANTITY_INVALID: '批次數量必須大於 0。',
        BATCH_EXPIRY_BEFORE_PRODUCTION: '到期日不得早於生產日。',
        BATCH_CREATE_FAILED: '批次建立失敗。',
        DOCUMENT_FIELDS_REQUIRED: '請填寫批次、文件類型與發行日。',
        EXCEPTION_RESPONSE_REQUIRED: '請填寫異常回覆。',
        STATION_REQUIRED: '找不到站點。',
        TEMPERATURE_STATUS_INVALID: '溫度狀態不正確。',
        TEMPERATURE_ACTION_REQUIRED: '請填寫處理動作。',
        QUARANTINE_REASON_REQUIRED: '請填寫隔離原因。',
        TRAINING_FIELDS_REQUIRED: '請填寫人員與訓練模組。',
        PURCHASE_ORDER_FIELDS_REQUIRED: '請填寫供應商、SKU 與數量。',
        RECALL_REASON_REQUIRED: '請填寫召回原因。',
        REFERRAL_REASON_REQUIRED: '請填寫扣回原因。',
        PRODUCT_STATUS_INVALID: '商品狀態不正確。',
        SETTLEMENT_FIELDS_REQUIRED: '請填寫站點與結算期間。',
        STATION_FIELDS_REQUIRED: '請填寫站點代碼、名稱與地址。',
        STATION_TYPE_INVALID: '站點型態必須為 A、B、C 或 D。',
        ACCOUNT_FIELDS_REQUIRED: '請填寫電子郵件、密碼（至少 8 碼）與顯示名稱。',
        ACCOUNT_ROLE_INVALID: '帳號角色不正確。',
        TICKET_NOT_FOUND: '找不到客服單。',
        MAINTENANCE_FIELDS_REQUIRED: '請填寫設備、保養類型與日期。',
        EQUIPMENT_STATUS_INVALID: '設備狀態不正確。',
        ORDER_NOT_PREPARABLE: '訂單目前不可標記為可取貨。',
        BATCH_ALREADY_RECALLED: '批次已召回，不能改為隔離。',
        BATCH_NOT_QUARANTINED: '批次不在隔離狀態。',
        HEATING_DURATION_INVALID: '加熱時間必須大於 0 秒。',
        SHIPMENT_QUANTITY_INVALID: '出貨數量必須大於 0。',
        SHIPMENT_SUPPLIER_MISMATCH: '批次不屬於此供應商。',
        BATCH_NOT_AVAILABLE: '批次目前不可出貨。',
        SHIPMENT_EXCEEDS_STOCK: '出貨數量超過可售庫存。',
        EXCEPTION_NOT_FOUND: '找不到異常單。',
        EXCEPTION_ALREADY_CLOSED: '異常單已結案。',
      };
      return `${messages[code] ?? code}${detail ? `（${detail}）` : ''}`;
    }
    return error.message;
  }
  return '發生未預期錯誤。';
}
