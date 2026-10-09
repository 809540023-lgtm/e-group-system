/**
 * 無障礙與版面驗收輔助（規劃書 05 章；模組 06）。
 *
 * 這些函式把「長者可用」的驗收條件變成可測試的規則，
 * 讓 UI 元件與頁面在 CI 就能被檢查，而不是只靠人工目視。
 */

import { BREAKPOINTS, FONT_SIZE, TARGET_SIZE } from './tokens.ts';

export interface A11yIssue {
  readonly rule: string;
  readonly detail: string;
}

export interface ElementSpec {
  readonly tag: string;
  readonly text?: string;
  readonly ariaLabel?: string;
  readonly role?: string;
  readonly heightPx?: number;
  readonly fontSizePx?: number;
  readonly isInteractive?: boolean;
  readonly isImage?: boolean;
  readonly alt?: string;
  readonly hasVisibleFocus?: boolean;
  readonly statusColorOnly?: boolean;
}

const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea']);

/** 檢查單一元素是否符合長者可用與 WCAG 2.2 AA 的最低要求。 */
export function auditElement(spec: ElementSpec): readonly A11yIssue[] {
  const issues: A11yIssue[] = [];
  const interactive = spec.isInteractive ?? INTERACTIVE_TAGS.has(spec.tag);

  if (interactive) {
    const height = spec.heightPx ?? 0;
    if (height < 48) {
      issues.push({ rule: 'target-size', detail: `${spec.tag} 高度 ${String(height)}px 小於 48px。` });
    }
    if (spec.hasVisibleFocus === false) {
      issues.push({ rule: 'focus-visible', detail: `${spec.tag} 缺少可見焦點樣式。` });
    }
    const label = spec.ariaLabel ?? spec.text ?? '';
    if (label.trim() === '') {
      issues.push({ rule: 'accessible-name', detail: `${spec.tag} 沒有可存取名稱。` });
    }
  }

  if (spec.isImage === true && (spec.alt === undefined || spec.alt.trim() === '')) {
    issues.push({ rule: 'image-alt', detail: '圖片缺少 alt 文字。' });
  }

  if (spec.statusColorOnly === true) {
    issues.push({ rule: 'status-not-color-only', detail: '狀態只以顏色表示，必須同時提供文字。' });
  }

  return issues;
}

export interface PageSpec {
  readonly viewportWidthPx: number;
  readonly hasHorizontalScroll: boolean;
  readonly bodyFontSizePx: number;
  readonly productNameFontSizePx?: number;
  readonly priceFontSizePx?: number;
  readonly primaryButtonHeightPx: number;
  readonly primaryButtonCoveredByFixedBar?: boolean;
  readonly hasAutoCarousel?: boolean;
  readonly hasFocusStealingModal?: boolean;
  readonly hidesShippingFee?: boolean;
  readonly hasCountdownTimer?: boolean;
}

/** 檢查整頁是否符合規劃書 05 章的版面與互動禁忌。 */
export function auditPage(spec: PageSpec): readonly A11yIssue[] {
  const issues: A11yIssue[] = [];

  if (spec.hasHorizontalScroll) {
    issues.push({ rule: 'no-horizontal-scroll', detail: `在 ${String(spec.viewportWidthPx)}px 寬出現橫向滾動。` });
  }
  if (spec.bodyFontSizePx < 20) {
    issues.push({ rule: 'body-font-size', detail: `正文 ${String(spec.bodyFontSizePx)}px 小於 20px。` });
  }
  if (spec.productNameFontSizePx !== undefined && spec.productNameFontSizePx < 22) {
    issues.push({ rule: 'product-name-font-size', detail: `商品名 ${String(spec.productNameFontSizePx)}px 小於 22px。` });
  }
  if (spec.priceFontSizePx !== undefined && (spec.priceFontSizePx < 28 || spec.priceFontSizePx > 32)) {
    issues.push({ rule: 'price-font-size', detail: `價格 ${String(spec.priceFontSizePx)}px 不在 28–32px。` });
  }
  if (spec.primaryButtonHeightPx < 48) {
    issues.push({ rule: 'primary-button-height', detail: `主要按鈕 ${String(spec.primaryButtonHeightPx)}px 小於 48px。` });
  }
  if (spec.primaryButtonCoveredByFixedBar === true) {
    issues.push({ rule: 'button-not-covered', detail: '主要按鈕被固定列遮住。' });
  }
  if (spec.hasAutoCarousel === true) {
    issues.push({ rule: 'no-auto-carousel', detail: '不應使用自動輪播。' });
  }
  if (spec.hasFocusStealingModal === true) {
    issues.push({ rule: 'no-focus-stealing-modal', detail: '不應使用搶焦點彈窗。' });
  }
  if (spec.hidesShippingFee === true) {
    issues.push({ rule: 'no-hidden-shipping', detail: '不應隱藏運費。' });
  }
  if (spec.hasCountdownTimer === true) {
    issues.push({ rule: 'no-short-countdown', detail: '不應使用短倒數。' });
  }

  return issues;
}

/** 200% 字型放大後仍不得出現橫向滾動。 */
export function auditZoom200(spec: { readonly viewportWidthPx: number; readonly hasHorizontalScroll: boolean }): readonly A11yIssue[] {
  if (!spec.hasHorizontalScroll) return [];
  return [{ rule: 'zoom-200-no-horizontal-scroll', detail: `字型放大 200% 後在 ${String(spec.viewportWidthPx)}px 出現橫向滾動。` }];
}

export const REQUIRED_VIEWPORTS = [BREAKPOINTS.mobile, BREAKPOINTS.desktop] as const;

/** 五個長者驗收任務（規劃書 05 章）。 */
export const ELDER_TASKS = [
  { id: 'find-product', label: '找到商品' },
  { id: 'choose-spec', label: '選規格' },
  { id: 'add-to-cart', label: '加購' },
  { id: 'confirm-total', label: '確認總額' },
  { id: 'check-order', label: '查訂單' },
] as const;

export interface ElderTaskRecord {
  readonly taskId: string;
  readonly participantId: string;
  readonly completed: boolean;
  readonly seconds: number;
  readonly stuckAt: string | null;
  readonly helpCount: number;
}

export interface ElderUsabilityReport {
  readonly participants: number;
  readonly records: readonly ElderTaskRecord[];
  readonly completionRate: number;
  readonly averageSeconds: number;
  readonly totalHelpCount: number;
  readonly meetsMinimumParticipants: boolean;
}

/** 至少三位實際長者；記錄完成時間、卡住位置及求助次數。 */
export function summarizeElderUsability(records: readonly ElderTaskRecord[]): ElderUsabilityReport {
  const participants = new Set(records.map((r) => r.participantId)).size;
  const completed = records.filter((r) => r.completed);
  const completionRate = records.length === 0 ? 0 : completed.length / records.length;
  const averageSeconds = records.length === 0 ? 0 : records.reduce((sum, r) => sum + r.seconds, 0) / records.length;
  const totalHelpCount = records.reduce((sum, r) => sum + r.helpCount, 0);
  return {
    participants,
    records,
    completionRate: Math.round(completionRate * 1000) / 1000,
    averageSeconds: Math.round(averageSeconds * 10) / 10,
    totalHelpCount,
    meetsMinimumParticipants: participants >= 3,
  };
}

/** 供元件使用的字級與尺寸常數，避免各頁自行硬編。 */
export const UI_METRICS = {
  bodyFontSizePx: Number.parseInt(FONT_SIZE.body, 10),
  productNameFontSizePx: Number.parseInt(FONT_SIZE.productName, 10),
  priceFontSizePx: Number.parseInt(FONT_SIZE.price, 10),
  minTargetPx: Number.parseInt(TARGET_SIZE.min, 10),
} as const;
