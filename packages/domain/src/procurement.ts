import { AppError } from './errors.ts';
import { type Money, addMoney, sumMoney, twd } from './money.ts';

/**
 * 採購與入庫。
 *
 * 核心不變式：
 * 1. 採購付款與客戶付款分開記帳。
 * 2. 實收檢查數量、規格、批號、效期及破損，不直接把採購數當已入庫。
 * 3. 已成立預購需求按供應商與採購批次彙總，可追原訂單且儲存數量分配。
 * 4. 替代品需客戶明確同意，不由 AI 自行換商品。
 */

export interface Supplier {
  readonly supplierId: string;
  readonly name: string;
  readonly country: 'JP' | 'TW' | 'OTHER';
  readonly active: boolean;
}

export interface SupplierQuote {
  readonly quoteId: string;
  readonly supplierId: string;
  readonly sku: string;
  readonly unitPriceJpy: number;
  readonly moq: number;
  /** 價格有效期，過期需重新詢價。 */
  readonly validUntil: string;
  readonly taxIncluded: boolean;
  readonly localShippingJpy: number;
  readonly leadTimeDays: number;
  /** 剩餘效期（天），食品與化粧品需檢查。 */
  readonly remainingShelfLifeDays: number | null;
  readonly quotedAt: string;
}

export interface PreorderDemand {
  readonly orderId: string;
  readonly orderLineId: string;
  readonly sku: string;
  readonly quantity: number;
  readonly paidAt: string;
}

export interface PurchaseBatch {
  readonly supplierId: string;
  readonly sku: string;
  readonly totalQuantity: number;
  readonly allocations: readonly { readonly orderId: string; readonly orderLineId: string; readonly quantity: number }[];
}

/**
 * 將已付款的預購需求按供應商與 SKU 彙總成採購批次，並保留原訂單分配。
 */
export function aggregatePreorderDemand(
  demands: readonly PreorderDemand[],
  supplierBySku: ReadonlyMap<string, string>,
): PurchaseBatch[] {
  const groups = new Map<string, PreorderDemand[]>();

  for (const demand of demands) {
    if (demand.quantity <= 0) {
      throw new AppError('VALIDATION_FAILED', `需求數量必須為正整數：${demand.orderLineId}`);
    }
    const supplierId = supplierBySku.get(demand.sku);
    if (!supplierId) {
      throw new AppError('VALIDATION_FAILED', `SKU ${demand.sku} 尚未指定供應商`);
    }
    const key = `${supplierId}\u0001${demand.sku}`;
    const list = groups.get(key) ?? [];
    list.push(demand);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .map(([key, list]) => {
      const [supplierId = '', sku = ''] = key.split('\u0001');
      return {
        supplierId,
        sku,
        totalQuantity: list.reduce((acc, d) => acc + d.quantity, 0),
        allocations: list
          .map((d) => ({ orderId: d.orderId, orderLineId: d.orderLineId, quantity: d.quantity }))
          .sort((a, b) => (a.orderLineId < b.orderLineId ? -1 : 1)),
      };
    })
    .sort((a, b) => (a.supplierId < b.supplierId ? -1 : a.supplierId > b.supplierId ? 1 : a.sku < b.sku ? -1 : 1));
}

export interface PurchaseOrderLine {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPriceJpy: number;
}

export interface PurchaseOrder {
  readonly purchaseOrderId: string;
  readonly supplierId: string;
  readonly lines: readonly PurchaseOrderLine[];
  readonly approvedBy: string;
  readonly createdAt: string;
}

export function purchaseOrderTotalJpy(order: PurchaseOrder): Money {
  const totals = order.lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
      throw new AppError('VALIDATION_FAILED', `採購數量必須為正整數：${l.sku}`);
    }
    if (!Number.isInteger(l.unitPriceJpy) || l.unitPriceJpy < 0) {
      throw new AppError('VALIDATION_FAILED', `日圓單價必須為非負整數：${l.sku}`);
    }
    return { amount: l.quantity * l.unitPriceJpy, currency: 'JPY' as const };
  });
  return sumMoney(totals, 'JPY');
}

export interface ReceiptLine {
  readonly sku: string;
  readonly orderedQuantity: number;
  readonly receivedQuantity: number;
  readonly lotNumber: string | null;
  readonly expiryDate: string | null;
  readonly damagedQuantity: number;
  readonly specMatches: boolean;
}

export type ReceiptDiscrepancy =
  | { readonly kind: 'shortage'; readonly sku: string; readonly missing: number }
  | { readonly kind: 'overage'; readonly sku: string; readonly extra: number }
  | { readonly kind: 'damaged'; readonly sku: string; readonly damaged: number }
  | { readonly kind: 'spec_mismatch'; readonly sku: string }
  | { readonly kind: 'expiring_soon'; readonly sku: string; readonly days: number }
  | { readonly kind: 'missing_lot'; readonly sku: string };

export interface ReceiptResult {
  readonly discrepancies: readonly ReceiptDiscrepancy[];
  /** 可入庫數量：實收減破損，且規格相符。 */
  readonly receivable: readonly { readonly sku: string; readonly quantity: number; readonly lotNumber: string | null; readonly expiryDate: string | null }[];
  readonly requiresCustomerConsent: boolean;
}

export function evaluateReceipt(
  lines: readonly ReceiptLine[],
  options: { readonly now: Date; readonly expiringSoonDays?: number },
): ReceiptResult {
  const expiringSoonDays = options.expiringSoonDays ?? 90;
  const discrepancies: ReceiptDiscrepancy[] = [];
  const receivable: ReceiptResult['receivable'][number][] = [];
  let requiresCustomerConsent = false;

  for (const line of lines) {
    if (!line.specMatches) {
      discrepancies.push({ kind: 'spec_mismatch', sku: line.sku });
      requiresCustomerConsent = true;
      continue;
    }
    if (line.receivedQuantity < line.orderedQuantity) {
      discrepancies.push({ kind: 'shortage', sku: line.sku, missing: line.orderedQuantity - line.receivedQuantity });
    }
    if (line.receivedQuantity > line.orderedQuantity) {
      discrepancies.push({ kind: 'overage', sku: line.sku, extra: line.receivedQuantity - line.orderedQuantity });
    }
    if (line.damagedQuantity > 0) {
      discrepancies.push({ kind: 'damaged', sku: line.sku, damaged: line.damagedQuantity });
    }
    if (line.lotNumber === null) {
      discrepancies.push({ kind: 'missing_lot', sku: line.sku });
    }
    if (line.expiryDate) {
      const days = Math.floor((new Date(line.expiryDate).getTime() - options.now.getTime()) / 86_400_000);
      if (days < expiringSoonDays) {
        discrepancies.push({ kind: 'expiring_soon', sku: line.sku, days });
      }
    }

    const quantity = line.receivedQuantity - line.damagedQuantity;
    if (quantity > 0) {
      receivable.push({ sku: line.sku, quantity, lotNumber: line.lotNumber, expiryDate: line.expiryDate });
    }
  }

  return { discrepancies, receivable, requiresCustomerConsent };
}

/** 重複入庫防護：同一採購單同一批號不得重複入庫。 */
export function assertNoDuplicateReceipt(
  existing: readonly { readonly purchaseOrderId: string; readonly lotNumber: string | null }[],
  next: { readonly purchaseOrderId: string; readonly lotNumber: string | null },
): void {
  const duplicate = existing.some(
    (r) => r.purchaseOrderId === next.purchaseOrderId && r.lotNumber === next.lotNumber,
  );
  if (duplicate) {
    throw new AppError('CONFLICT', `採購單 ${next.purchaseOrderId} 批號 ${next.lotNumber ?? '(無)'} 已入庫，不可重複`);
  }
}

/** 採購付款與客戶付款分開記帳。 */
export interface ProcurementLedgerEntry {
  readonly kind: 'supplier_payment' | 'customer_payment';
  readonly referenceId: string;
  readonly amount: Money;
  readonly occurredAt: string;
}

export function assertSeparateLedgers(entries: readonly ProcurementLedgerEntry[]): void {
  const supplierRefs = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== 'supplier_payment') continue;
    if (supplierRefs.has(entry.referenceId)) {
      throw new AppError('CONFLICT', `供應商付款 ${entry.referenceId} 重複記帳`);
    }
    supplierRefs.add(entry.referenceId);
  }
}

export function procurementCostTwd(
  purchaseJpy: Money,
  localShippingJpy: Money,
  fxRate: number,
): Money {
  const totalJpy = addMoney(purchaseJpy, localShippingJpy);
  return twd(Math.round(totalJpy.amount * fxRate));
}
