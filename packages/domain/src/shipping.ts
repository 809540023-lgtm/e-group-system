import { AppError } from './errors.ts';
import { type Money, money, roundHalfAwayFromZero, twd } from './money.ts';

/**
 * 物流與配送計價。
 *
 * 核心不變式：
 * 1. 計價重量 = max(實重, 材積重)，材積重 = 長×寬×高 ÷ 材積係數。
 * 2. 費率、材積係數、級距、最低收費、燃油附加、偏遠費與稅費負擔全部版本化。
 * 3. 「3 公斤 20 天 NT$380」只是一個有適用日期、航線及商品限制的配送方案，不是通用價。
 * 4. 一筆明細可分多次出貨，數量守恆；原始追蹤紀錄不覆蓋。
 */

export type ShippingChannel =
  | 'tw_stock'          // 臺灣現貨
  | 'jp_consolidation'  // 日臺集貨預購
  | 'jp_direct'         // 個人直寄
  | 'inquiry';          // 詢價

export interface Dimensions {
  readonly lengthCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
}

export interface RateTier {
  /** 級距上限（公克），最後一級用 null 表示無上限。 */
  readonly upToG: number | null;
  readonly feeTwd: number;
}

export interface ShippingRateCard {
  readonly version: string;
  readonly channel: ShippingChannel;
  /** 材積係數（cm³/kg），例如 6000。 */
  readonly volumetricDivisor: number;
  readonly tiers: readonly RateTier[];
  readonly minimumChargeTwd: number;
  readonly fuelSurchargeRate: number;
  readonly remoteAreaSurchargeTwd: number;
  /** 稅費負擔：'customer' 由客戶負擔、'seller' 由賣方吸收。 */
  readonly taxBurden: 'customer' | 'seller';
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  /** 商品限制，例如冷鏈、肉品、植物、噴霧、酒類、電池。 */
  readonly restrictedCategories: readonly string[];
  readonly maxWeightG: number;
  readonly maxLongestSideCm: number;
}

export interface ShippingQuoteInput {
  readonly channel: ShippingChannel;
  readonly actualWeightG: number;
  readonly dimensions: Dimensions | null;
  readonly destination: { readonly city: string; readonly isRemote: boolean };
  readonly category: string;
  readonly rateCard: ShippingRateCard;
  readonly now: Date;
}

export interface ShippingQuote {
  readonly channel: ShippingChannel;
  readonly chargeableWeightG: number;
  readonly baseFeeTwd: number;
  readonly fuelSurchargeTwd: number;
  readonly remoteSurchargeTwd: number;
  readonly totalFeeTwd: number;
  readonly taxBurden: 'customer' | 'seller';
  readonly rateCardVersion: string;
  readonly exceptions: readonly string[];
}

export function volumetricWeightG(dimensions: Dimensions, divisor: number): number {
  if (divisor <= 0) {
    throw new AppError('VALIDATION_FAILED', '材積係數必須大於零');
  }
  const volumeCm3 = dimensions.lengthCm * dimensions.widthCm * dimensions.heightCm;
  // 材積係數單位為 cm³/kg，因此先換算成公斤再轉公克。
  return Math.ceil((volumeCm3 / divisor) * 1000);
}

export function chargeableWeightG(actualWeightG: number, dimensions: Dimensions | null, divisor: number): number {
  if (actualWeightG < 0) {
    throw new AppError('VALIDATION_FAILED', '實重不可為負數');
  }
  if (!dimensions) return actualWeightG;
  return Math.max(actualWeightG, volumetricWeightG(dimensions, divisor));
}

function tierFee(chargeableG: number, tiers: readonly RateTier[]): number {
  for (const tier of tiers) {
    if (tier.upToG === null || chargeableG <= tier.upToG) {
      return tier.feeTwd;
    }
  }
  const last = tiers[tiers.length - 1];
  if (!last) throw new AppError('INTERNAL', '費率級距為空');
  return last.feeTwd;
}

export function quoteShipping(input: ShippingQuoteInput): ShippingQuote {
  const { rateCard, actualWeightG, dimensions, destination, category } = input;
  const exceptions: string[] = [];

  if (rateCard.channel !== input.channel) {
    throw new AppError('VALIDATION_FAILED', `費率版本 ${rateCard.version} 不適用於通路 ${input.channel}`);
  }

  const nowIso = input.now.toISOString().slice(0, 10);
  if (nowIso < rateCard.effectiveFrom || (rateCard.effectiveTo !== null && nowIso > rateCard.effectiveTo)) {
    throw new AppError('VALIDATION_FAILED', `費率版本 ${rateCard.version} 不在有效期間內`);
  }

  if (rateCard.restrictedCategories.includes(category)) {
    exceptions.push(`品類 ${category} 屬於限制品，需另行審核`);
  }

  const chargeable = chargeableWeightG(actualWeightG, dimensions, rateCard.volumetricDivisor);

  if (chargeable > rateCard.maxWeightG) {
    exceptions.push(`計價重量 ${chargeable}g 超過上限 ${rateCard.maxWeightG}g，需拆包或改走詢價`);
  }
  if (dimensions) {
    const longest = Math.max(dimensions.lengthCm, dimensions.widthCm, dimensions.heightCm);
    if (longest > rateCard.maxLongestSideCm) {
      exceptions.push(`最長邊 ${longest}cm 超過上限 ${rateCard.maxLongestSideCm}cm，需拆包`);
    }
  }

  const base = Math.max(tierFee(chargeable, rateCard.tiers), rateCard.minimumChargeTwd);
  const fuel = roundHalfAwayFromZero(base * rateCard.fuelSurchargeRate);
  const remote = destination.isRemote ? rateCard.remoteAreaSurchargeTwd : 0;

  return {
    channel: input.channel,
    chargeableWeightG: chargeable,
    baseFeeTwd: base,
    fuelSurchargeTwd: fuel,
    remoteSurchargeTwd: remote,
    totalFeeTwd: base + fuel + remote,
    taxBurden: rateCard.taxBurden,
    rateCardVersion: rateCard.version,
    exceptions,
  };
}

/** 未知重量或配送條件者先詢價，不得直接收款。 */
export function requiresInquiry(input: {
  readonly actualWeightG: number | null;
  readonly dimensions: Dimensions | null;
  readonly category: string;
  readonly rateCard: ShippingRateCard;
}): boolean {
  if (input.actualWeightG === null || input.actualWeightG <= 0) return true;
  if (!input.dimensions) return true;
  if (input.rateCard.restrictedCategories.includes(input.category)) return true;
  return false;
}

export interface ShipmentItemAllocation {
  readonly orderLineId: string;
  readonly sku: string;
  readonly quantity: number;
}

export interface Shipment {
  readonly shipmentId: string;
  readonly trackingNo: string | null;
  readonly items: readonly ShipmentItemAllocation[];
  readonly status: 'packed' | 'shipped' | 'customs' | 'tw_delivery' | 'delivered' | 'exception';
}

/**
 * 驗證分批出貨數量守恆：同一訂單明細的已出貨總量不得超過訂購量。
 */
export function assertAllocationConserved(
  ordered: ReadonlyMap<string, number>,
  shipments: readonly Shipment[],
): void {
  const shipped = new Map<string, number>();
  for (const shipment of shipments) {
    for (const item of shipment.items) {
      shipped.set(item.orderLineId, (shipped.get(item.orderLineId) ?? 0) + item.quantity);
    }
  }
  for (const [orderLineId, total] of shipped) {
    const orderedQty = ordered.get(orderLineId);
    if (orderedQty === undefined) {
      throw new AppError('VALIDATION_FAILED', `出貨明細 ${orderLineId} 不屬於此訂單`);
    }
    if (total > orderedQty) {
      throw new AppError('VALIDATION_FAILED', `明細 ${orderLineId} 已出貨 ${total} 超過訂購 ${orderedQty}`);
    }
  }
}

export interface TrackingEvent {
  readonly shipmentId: string;
  readonly status: string;
  readonly occurredAt: string;
  readonly source: string;
}

/**
 * 追蹤事件為 append-only：重複更新不覆蓋原始紀錄，只新增事件。
 */
export function appendTrackingEvent(
  existing: readonly TrackingEvent[],
  next: TrackingEvent,
): readonly TrackingEvent[] {
  const duplicate = existing.some(
    (e) => e.shipmentId === next.shipmentId && e.status === next.status && e.occurredAt === next.occurredAt,
  );
  if (duplicate) return existing;
  return [...existing, next];
}

export function latestTrackingStatus(events: readonly TrackingEvent[]): string | null {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
  return sorted[sorted.length - 1]?.status ?? null;
}

/** 報關資料未完成時進 exception，不得出貨。 */
export function assertCustomsReady(input: {
  readonly channel: ShippingChannel;
  readonly customsIdProvided: boolean;
  readonly ezWayDelegationConfirmed: boolean;
}): void {
  if (input.channel !== 'jp_direct') return;
  if (!input.customsIdProvided) {
    throw new AppError('VALIDATION_FAILED', '個人直寄需先提供報關身分資料');
  }
  if (!input.ezWayDelegationConfirmed) {
    throw new AppError('VALIDATION_FAILED', 'EZ WAY 委任尚未完成，實際查驗以物流商結果為準');
  }
}

export function shippingFeeMoney(quote: ShippingQuote): Money {
  return money(quote.totalFeeTwd, 'TWD');
}

export function zeroShippingFee(): Money {
  return twd(0);
}
