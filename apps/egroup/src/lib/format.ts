export function formatTwd(amount: number | string | null | undefined): string {
  const value = typeof amount === 'string' ? Number(amount) : (amount ?? 0);
  return `NT$${Math.round(value).toLocaleString('en-US')}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatNumber(value: number | string | null | undefined, digits = 0): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export const ORDER_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending_payment: '待付款',
  paid: '已付款',
  preparing: '備餐中',
  ready: '可取貨',
  delivered: '已交付',
  cancelled: '已取消',
  refunded: '已退款',
};

export const STORAGE_LABELS: Readonly<Record<string, string>> = {
  frozen: '冷凍',
  chilled: '冷藏',
  ambient: '常溫',
};

export const STATION_TYPE_LABELS: Readonly<Record<string, string>> = {
  A: 'A 型 店中取貨',
  B: 'B 型 自助冷鏈櫃',
  C: 'C 型 加熱組餐',
  D: 'D 型 區域補給',
};

export const ROLE_LABELS: Readonly<Record<string, string>> = {
  customer: '顧客',
  supplier: '供應商',
  station: '加盟站點',
  admin: '總部',
};

export const PRODUCT_STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: '草稿',
  active: '上架',
  suspended: '停賣',
  recalled: '召回',
};

export const BATCH_STATUS_LABELS: Readonly<Record<string, string>> = {
  available: '可售',
  quarantined: '隔離',
  recalled: '召回',
  depleted: '售完',
};

export const TEMPERATURE_STATUS_LABELS: Readonly<Record<string, string>> = {
  ok: '正常',
  warning: '警戒',
  breach: '超標',
};

export function statusTone(status: string): 'ok' | 'warn' | 'danger' | 'muted' | 'info' {
  if (['active', 'delivered', 'paid', 'ok', 'approved', 'received', 'completed', 'sent'].includes(status)) return 'ok';
  if (['pending_payment', 'preparing', 'ready', 'warning', 'pending', 'draft', 'in_transit', 'requested'].includes(status)) return 'warn';
  if (['recalled', 'suspended', 'breach', 'cancelled', 'refunded', 'rejected', 'failed', 'quarantined', 'defaulted'].includes(status)) return 'danger';
  if (['closed', 'depleted', 'retired', 'ended'].includes(status)) return 'muted';
  return 'info';
}
