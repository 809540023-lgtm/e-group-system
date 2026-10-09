/**
 * 共用元件（規劃書 05 章；模組 06）。
 *
 * 以框架無關的 HTML 產生器實作，讓前臺 SSR、示範伺服器與測試共用同一份規則。
 * 所有輸出都經過跳脫，且狀態一律附文字，不以顏色單獨表達。
 */

import { formatMoney, type Money } from '@jp/domain';
import { COLORS, FONT_SIZE, RADIUS, SPACING, TARGET_SIZE } from './tokens.ts';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type SupplyModeLabel = 'in_stock' | 'preorder' | 'inquiry';

export const SUPPLY_MODE_TEXT: Record<SupplyModeLabel, string> = {
  in_stock: '臺灣現貨',
  preorder: '日本預購',
  inquiry: '需詢問',
};

export type OrderStatusTone = 'neutral' | 'progress' | 'success' | 'warning' | 'danger';

export interface StatusBadge {
  readonly label: string;
  readonly tone: OrderStatusTone;
  /** 一律提供文字說明，避免只以顏色表達。 */
  readonly description: string;
}

const TONE_COLOR: Record<OrderStatusTone, string> = {
  neutral: COLORS.inkMuted,
  progress: COLORS.info,
  success: COLORS.success,
  warning: COLORS.warning,
  danger: COLORS.danger,
};

const TONE_SYMBOL: Record<OrderStatusTone, string> = {
  neutral: '○',
  progress: '◐',
  success: '✓',
  warning: '!',
  danger: '✕',
};

export function renderStatusBadge(badge: StatusBadge): string {
  const color = TONE_COLOR[badge.tone];
  const symbol = TONE_SYMBOL[badge.tone];
  return `<span class="jp-badge" style="color:${color};border-color:${color}" role="status" aria-label="${escapeHtml(`${badge.label}：${badge.description}`)}"><span aria-hidden="true">${symbol}</span> ${escapeHtml(badge.label)}</span>`;
}

export interface ButtonOptions {
  readonly label: string;
  readonly variant?: 'primary' | 'secondary' | 'quiet';
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly href?: string;
  readonly ariaLabel?: string;
  readonly name?: string;
  readonly value?: string;
}

/** 按鈕高度至少 48px；送出後停用並顯示處理中。 */
export function renderButton(options: ButtonOptions): string {
  const variant = options.variant ?? 'primary';
  const disabled = options.disabled === true || options.busy === true;
  const label = options.busy === true ? `${options.label}（處理中…）` : options.label;
  const aria = options.ariaLabel ?? options.label;
  const style = [
    `min-height:${TARGET_SIZE.min}`,
    `font-size:${FONT_SIZE.button}`,
    `border-radius:${RADIUS.md}`,
    `padding:0 ${SPACING.lg}`,
    variant === 'primary' ? `background:${COLORS.brandDeep};color:${COLORS.creamRaised};border:2px solid ${COLORS.brandDeep}` : '',
    variant === 'secondary' ? `background:${COLORS.creamRaised};color:${COLORS.brandDeep};border:2px solid ${COLORS.brandDeep}` : '',
    variant === 'quiet' ? `background:transparent;color:${COLORS.brandDeep};border:2px solid transparent;text-decoration:underline` : '',
  ]
    .filter((s) => s !== '')
    .join(';');

  const attrs = [
    `class="jp-button jp-button--${variant}"`,
    `style="${style}"`,
    `aria-label="${escapeHtml(aria)}"`,
    disabled ? 'aria-disabled="true" disabled' : '',
    options.busy === true ? 'aria-busy="true"' : '',
    options.name !== undefined ? `name="${escapeHtml(options.name)}"` : '',
    options.value !== undefined ? `value="${escapeHtml(options.value)}"` : '',
  ]
    .filter((s) => s !== '')
    .join(' ');

  if (options.href !== undefined && !disabled) {
    return `<a href="${escapeHtml(options.href)}" ${attrs.replace('class="jp-button', 'class="jp-button jp-button--link')} style="${style};display:inline-flex;align-items:center;justify-content:center;text-decoration:none">${escapeHtml(label)}</a>`;
  }
  return `<button type="${options.type ?? 'button'}" ${attrs}>${escapeHtml(label)}</button>`;
}

export interface QuantityStepperOptions {
  readonly name: string;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly label?: string;
}

/** 數量加減有文字與可辨識符號，且按鈕 ≥48px。 */
export function renderQuantityStepper(options: QuantityStepperOptions): string {
  const min = options.min ?? 1;
  const max = options.max ?? 99;
  const label = options.label ?? '數量';
  const dec = renderButton({ label: '減少', variant: 'secondary', ariaLabel: `${label}減少一件`, name: `${options.name}_dec`, value: '1' });
  const inc = renderButton({ label: '增加', variant: 'secondary', ariaLabel: `${label}增加一件`, name: `${options.name}_inc`, value: '1' });
  return `<div class="jp-stepper" role="group" aria-label="${escapeHtml(label)}">${dec}<input type="number" name="${escapeHtml(options.name)}" value="${String(options.value)}" min="${String(min)}" max="${String(max)}" step="1" inputmode="numeric" aria-label="${escapeHtml(label)}" style="min-height:${TARGET_SIZE.min};font-size:${FONT_SIZE.body};width:5rem;text-align:center;border:2px solid ${COLORS.borderStrong};border-radius:${RADIUS.md}">${inc}</div>`;
}

export interface ProductCardOptions {
  readonly title: string;
  readonly spec?: string;
  readonly price: Money;
  readonly supplyMode: SupplyModeLabel;
  readonly imageUrl?: string;
  readonly imageAlt?: string;
  readonly href: string;
  readonly arrivalWindow?: string;
  readonly origin?: string;
  readonly originalPrice?: Money;
  /** 只有可驗證基準價時才顯示原價折扣。 */
  readonly originalPriceVerified?: boolean;
}

/** 商品卡只顯示圖片、名稱、關鍵規格、臺幣售價、供貨方式與加入購物車。 */
export function renderProductCard(options: ProductCardOptions): string {
  const image =
    options.imageUrl === undefined
      ? ''
      : `<img src="${escapeHtml(options.imageUrl)}" alt="${escapeHtml(options.imageAlt ?? options.title)}" loading="lazy" decoding="async" style="width:100%;height:auto;border-radius:${RADIUS.md};background:${COLORS.creamSunken}">`;
  const spec = options.spec === undefined ? '' : `<p class="jp-card__spec" style="font-size:${FONT_SIZE.caption};color:${COLORS.inkMuted};margin:${SPACING.xs} 0">${escapeHtml(options.spec)}</p>`;
  const arrival = options.arrivalWindow === undefined ? '' : `<p style="font-size:${FONT_SIZE.caption};color:${COLORS.inkMuted};margin:${SPACING.xs} 0">到貨區間：${escapeHtml(options.arrivalWindow)}</p>`;
  const origin = options.origin === undefined ? '' : `<p style="font-size:${FONT_SIZE.caption};color:${COLORS.inkMuted};margin:${SPACING.xs} 0">產地：${escapeHtml(options.origin)}</p>`;
  const showOriginal = options.originalPrice !== undefined && options.originalPriceVerified === true;
  const original = showOriginal
    ? `<span style="font-size:${FONT_SIZE.caption};color:${COLORS.inkMuted};text-decoration:line-through;margin-left:${SPACING.sm}">原價 ${escapeHtml(formatMoney(options.originalPrice as Money))}</span>`
    : '';
  return `<article class="jp-card" style="background:${COLORS.creamRaised};border:1px solid ${COLORS.border};border-radius:${RADIUS.lg};padding:${SPACING.md};display:flex;flex-direction:column;gap:${SPACING.sm}">
  ${image}
  <h3 style="font-size:${FONT_SIZE.productName};line-height:1.3;margin:0"><a href="${escapeHtml(options.href)}" style="color:${COLORS.ink};text-decoration:none">${escapeHtml(options.title)}</a></h3>
  ${spec}
  <p style="font-size:${FONT_SIZE.price};font-weight:700;color:${COLORS.brandDeep};margin:${SPACING.xs} 0">${escapeHtml(formatMoney(options.price))}${original}</p>
  <p style="margin:0">${renderStatusBadge({ label: SUPPLY_MODE_TEXT[options.supplyMode], tone: options.supplyMode === 'in_stock' ? 'success' : options.supplyMode === 'preorder' ? 'progress' : 'warning', description: options.supplyMode === 'in_stock' ? '可立即出貨' : options.supplyMode === 'preorder' ? '需向日本下單後出貨' : '需先詢問供貨' })}</p>
  ${arrival}
  ${origin}
  <form method="post" action="/cart/add" style="margin-top:auto">
    <input type="hidden" name="sku" value="${escapeHtml(options.href.split('/').pop() ?? '')}">
    ${renderButton({ label: '加入購物車', type: 'submit', ariaLabel: `將 ${options.title} 加入購物車` })}
  </form>
</article>`;
}

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly current?: boolean;
}

/** 全站一致 navigation；主要入口保留首頁、商品分類、購物車、訂單查詢與客服。 */
export function renderNavigation(items: readonly NavItem[], options: { readonly cartCount?: number } = {}): string {
  const links = items
    .map((item) => {
      const suffix = item.href === '/cart' && (options.cartCount ?? 0) > 0 ? `（${String(options.cartCount)} 件）` : '';
      return `<li style="margin:0"><a href="${escapeHtml(item.href)}"${item.current === true ? ' aria-current="page"' : ''} style="display:inline-flex;align-items:center;min-height:${TARGET_SIZE.min};padding:0 ${SPACING.md};font-size:${FONT_SIZE.body};color:${COLORS.ink};text-decoration:${item.current === true ? 'underline' : 'none'}">${escapeHtml(item.label)}${escapeHtml(suffix)}</a></li>`;
    })
    .join('');
  return `<nav aria-label="主要選單" style="background:${COLORS.creamRaised};border-bottom:1px solid ${COLORS.border}"><ul style="display:flex;flex-wrap:wrap;gap:${SPACING.xs};list-style:none;margin:0;padding:${SPACING.sm} ${SPACING.md};max-width:1120px;margin:0 auto">${links}</ul></nav>`;
}

export interface CheckoutStep {
  readonly index: number;
  readonly label: string;
  readonly state: 'done' | 'current' | 'todo';
}

/** 手機以單欄結帳、簡單進度文字為主。 */
export function renderCheckoutProgress(steps: readonly CheckoutStep[]): string {
  const text = steps
    .map((s) => {
      const mark = s.state === 'done' ? '已完成' : s.state === 'current' ? '進行中' : '未開始';
      return `<li style="margin:0 0 ${SPACING.xs} 0">第 ${String(s.index)} 步 ${escapeHtml(s.label)}：${mark}</li>`;
    })
    .join('');
  return `<ol aria-label="結帳進度" style="list-style:none;padding:0;margin:0 0 ${SPACING.md} 0;font-size:${FONT_SIZE.body}">${text}</ol>`;
}

export interface FeeLine {
  readonly label: string;
  readonly amount: Money;
  readonly note?: string;
}

/** 結帳第二步：商品合計、運費、稅費說明、優惠與總額，運費不得隱藏。 */
export function renderFeeBreakdown(lines: readonly FeeLine[], total: Money): string {
  const rows = lines
    .map(
      (l) =>
        `<tr><th scope="row" style="text-align:left;font-weight:400;padding:${SPACING.sm} 0">${escapeHtml(l.label)}${l.note === undefined ? '' : `<br><span style="font-size:${FONT_SIZE.caption};color:${COLORS.inkMuted}">${escapeHtml(l.note)}</span>`}</th><td style="text-align:right;padding:${SPACING.sm} 0">${escapeHtml(formatMoney(l.amount))}</td></tr>`,
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:${FONT_SIZE.body}"><caption style="text-align:left;font-size:${FONT_SIZE.caption};color:${COLORS.inkMuted}">費用明細（含運費與稅費說明）</caption><tbody>${rows}<tr><th scope="row" style="text-align:left;padding:${SPACING.sm} 0;border-top:2px solid ${COLORS.borderStrong}">應付總額</th><td style="text-align:right;padding:${SPACING.sm} 0;border-top:2px solid ${COLORS.borderStrong};font-size:${FONT_SIZE.priceSmall};font-weight:700;color:${COLORS.brandDeep}">${escapeHtml(formatMoney(total))}</td></tr></tbody></table>`;
}

export interface EmptyStateOptions {
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly actionHref?: string;
}

export function renderEmptyState(options: EmptyStateOptions): string {
  const action =
    options.actionLabel === undefined || options.actionHref === undefined
      ? ''
      : renderButton({ label: options.actionLabel, href: options.actionHref, variant: 'secondary' });
  return `<div class="jp-empty" role="status" style="background:${COLORS.creamSunken};border:1px dashed ${COLORS.borderStrong};border-radius:${RADIUS.lg};padding:${SPACING.xl};text-align:center"><h2 style="font-size:${FONT_SIZE.heading};margin:0 0 ${SPACING.sm} 0">${escapeHtml(options.title)}</h2><p style="font-size:${FONT_SIZE.body};color:${COLORS.inkMuted};margin:0 0 ${SPACING.md} 0">${escapeHtml(options.description)}</p>${action}</div>`;
}

export interface ErrorSummaryOptions {
  readonly title?: string;
  readonly errors: readonly { readonly field: string; readonly message: string }[];
}

/** 錯誤提示：文字說明、可聚焦、可回到欄位。 */
export function renderErrorSummary(options: ErrorSummaryOptions): string {
  if (options.errors.length === 0) return '';
  const items = options.errors
    .map((e) => `<li style="margin:0 0 ${SPACING.xs} 0"><a href="#${escapeHtml(e.field)}" style="color:${COLORS.danger};font-size:${FONT_SIZE.body}">${escapeHtml(e.message)}</a></li>`)
    .join('');
  return `<div class="jp-error-summary" role="alert" tabindex="-1" style="border:2px solid ${COLORS.danger};border-radius:${RADIUS.md};padding:${SPACING.md};background:${COLORS.creamRaised}"><h2 style="font-size:${FONT_SIZE.bodyLarge};margin:0 0 ${SPACING.sm} 0;color:${COLORS.danger}">${escapeHtml(options.title ?? '請修正以下問題')}</h2><ul style="margin:0;padding-left:${SPACING.lg}">${items}</ul></div>`;
}

export interface FieldOptions {
  readonly id: string;
  readonly label: string;
  readonly type?: 'text' | 'tel' | 'email' | 'number' | 'textarea';
  readonly value?: string;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string;
  readonly autocomplete?: string;
  readonly inputMode?: 'text' | 'tel' | 'numeric' | 'email';
}

/** 表單欄位：標籤、提示與錯誤都與欄位關聯。 */
export function renderField(options: FieldOptions): string {
  const type = options.type ?? 'text';
  const describedBy = [options.hint === undefined ? null : `${options.id}-hint`, options.error === undefined ? null : `${options.id}-error`].filter((v): v is string => v !== null);
  const aria = describedBy.length > 0 ? ` aria-describedby="${describedBy.join(' ')}"` : '';
  const invalid = options.error === undefined ? '' : ' aria-invalid="true"';
  const required = options.required === true ? ' required aria-required="true"' : '';
  const common = `id="${escapeHtml(options.id)}" name="${escapeHtml(options.id)}"${required}${aria}${invalid}${options.autocomplete === undefined ? '' : ` autocomplete="${escapeHtml(options.autocomplete)}"`}${options.inputMode === undefined ? '' : ` inputmode="${escapeHtml(options.inputMode)}"`} style="width:100%;min-height:${TARGET_SIZE.min};font-size:${FONT_SIZE.body};padding:${SPACING.sm};border:2px solid ${options.error === undefined ? COLORS.borderStrong : COLORS.danger};border-radius:${RADIUS.md};background:${COLORS.creamRaised};color:${COLORS.ink}"`;
  const control =
    type === 'textarea'
      ? `<textarea ${common} rows="4">${escapeHtml(options.value ?? '')}</textarea>`
      : `<input type="${type}" ${common} value="${escapeHtml(options.value ?? '')}">`;
  const hint = options.hint === undefined ? '' : `<p id="${escapeHtml(options.id)}-hint" style="font-size:${FONT_SIZE.caption};color:${COLORS.inkMuted};margin:${SPACING.xs} 0 0 0">${escapeHtml(options.hint)}</p>`;
  const error = options.error === undefined ? '' : `<p id="${escapeHtml(options.id)}-error" style="font-size:${FONT_SIZE.caption};color:${COLORS.danger};margin:${SPACING.xs} 0 0 0">錯誤：${escapeHtml(options.error)}</p>`;
  return `<div class="jp-field" style="margin-bottom:${SPACING.md}"><label for="${escapeHtml(options.id)}" style="display:block;font-size:${FONT_SIZE.body};margin-bottom:${SPACING.xs}">${escapeHtml(options.label)}${options.required === true ? '（必填）' : ''}</label>${control}${hint}${error}</div>`;
}

export interface PageShellOptions {
  readonly title: string;
  readonly description: string;
  readonly navigation: readonly NavItem[];
  readonly body: string;
  readonly cartCount?: number;
  readonly canonicalUrl?: string;
  readonly publishedVersion?: string;
}

/** 頁面外殼：一致字級、留白、米白底與深綠主色。 */
export function renderPageShell(options: PageShellOptions): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}</title>
<meta name="description" content="${escapeHtml(options.description)}">
${options.canonicalUrl === undefined ? '' : `<link rel="canonical" href="${escapeHtml(options.canonicalUrl)}">`}
${options.publishedVersion === undefined ? '' : `<meta name="jp-published-version" content="${escapeHtml(options.publishedVersion)}">`}
<style>
  :root { color-scheme: light; }
  html { font-size: 100%; }
  body { margin:0; background:${COLORS.cream}; color:${COLORS.ink}; font-size:${FONT_SIZE.body}; line-height:1.6; font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif; }
  a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline:3px solid ${COLORS.focusRing}; outline-offset:2px; }
  main { max-width:1120px; margin:0 auto; padding:${SPACING.lg} ${SPACING.md} ${SPACING.xxl}; }
  .jp-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:${SPACING.md}; }
  @media (max-width: 480px) { .jp-grid { grid-template-columns:1fr; } }
  @media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important; } }
</style>
</head>
<body>
<a href="#main" style="position:absolute;left:-9999px;top:0;background:${COLORS.brandDeep};color:${COLORS.creamRaised};padding:${SPACING.sm} ${SPACING.md};min-height:${TARGET_SIZE.min};display:inline-flex;align-items:center" onfocus="this.style.left='0'" onblur="this.style.left='-9999px'">跳到主要內容</a>
${renderNavigation(options.navigation, options.cartCount === undefined ? {} : { cartCount: options.cartCount })}
<main id="main">
${options.body}
</main>
<footer style="border-top:1px solid ${COLORS.border};padding:${SPACING.lg} ${SPACING.md};font-size:${FONT_SIZE.caption};color:${COLORS.inkMuted}">
<p style="max-width:1120px;margin:0 auto">客服時間：週一至週五 10:00–18:00（臺北時間）。訂單問題請提供訂單編號。</p>
</footer>
</body>
</html>`;
}

export const DEFAULT_NAVIGATION: readonly NavItem[] = [
  { label: '首頁', href: '/' },
  { label: '商品分類', href: '/categories' },
  { label: '購物車', href: '/cart' },
  { label: '訂單查詢', href: '/orders' },
  { label: '客服', href: '/support' },
];
