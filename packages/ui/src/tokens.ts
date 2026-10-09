/**
 * 設計權杖（規劃書 05 章；模組 06）。
 *
 * 深綠與米白配色、正文 20px、商品名至少 22px、價格 28–32px、按鈕至少 48px。
 * 對比以 WCAG 2.2 AA 為下限；狀態一律附文字，不以顏色單獨表達。
 */

export interface ColorToken {
  readonly name: string;
  readonly value: string;
  /** 相對亮度（0–1），用於對比檢查。 */
  readonly luminance: number;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`INVALID_COLOR: ${hex} 不是 #RRGGBB 格式。`);
  }
  const r = srgbToLinear(Number.parseInt(normalized.slice(0, 2), 16));
  const g = srgbToLinear(Number.parseInt(normalized.slice(2, 4), 16));
  const b = srgbToLinear(Number.parseInt(normalized.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export const COLORS = {
  /** 主色：深綠，用於主要按鈕與標題。 */
  brandDeep: '#1F4D3A',
  brandDeepHover: '#173B2D',
  brandDeepActive: '#102A20',
  /** 次要色：中綠，用於次要按鈕邊框與圖示。 */
  brandMid: '#2F6B52',
  /** 底色：米白，全站背景。 */
  cream: '#FBF7EF',
  creamRaised: '#FFFFFF',
  creamSunken: '#F2EBDD',
  /** 文字：近黑綠，確保米白底上對比 ≥ 7:1。 */
  ink: '#1A1A17',
  inkMuted: '#4A4A44',
  /** 邊框。 */
  border: '#C9C0AE',
  borderStrong: '#8C8271',
  /** 狀態色（一律搭配文字）。 */
  success: '#1F6B3A',
  warning: '#8A5A00',
  danger: '#9B2C2C',
  info: '#1F4D6B',
  /** 焦點外框，鍵盤操作可見。 */
  focusRing: '#0B5FFF',
} as const;

export type ColorName = keyof typeof COLORS;

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

/** 字級：正文 20px 起跳，商品名 ≥22px，價格 28–32px。 */
export const FONT_SIZE = {
  body: '20px',
  bodyLarge: '22px',
  productName: '24px',
  price: '30px',
  priceSmall: '28px',
  heading: '32px',
  headingLarge: '40px',
  caption: '18px',
  button: '20px',
} as const;

export const LINE_HEIGHT = {
  body: 1.6,
  heading: 1.3,
  button: 1.2,
} as const;

/** 觸控目標：按鈕與可點元素至少 48px。 */
export const TARGET_SIZE = {
  min: '48px',
  comfortable: '56px',
  large: '64px',
} as const;

export const RADIUS = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  pill: '999px',
} as const;

export const FOCUS = {
  outlineWidth: '3px',
  outlineOffset: '2px',
  outlineStyle: 'solid',
} as const;

export const BREAKPOINTS = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
} as const;

export const LAYOUT = {
  maxContentWidth: '1120px',
  /** 手機單欄結帳。 */
  checkoutColumnsMobile: 1,
  checkoutColumnsDesktop: 2,
} as const;

export interface ContrastCheck {
  readonly pair: string;
  readonly ratio: number;
  readonly required: number;
  readonly passes: boolean;
}

/** 檢查關鍵文字／底色組合是否達 WCAG 2.2 AA。 */
export function auditContrast(): readonly ContrastCheck[] {
  const pairs: readonly { readonly pair: string; readonly fg: string; readonly bg: string; readonly required: number }[] = [
    { pair: '正文／米白底', fg: COLORS.ink, bg: COLORS.cream, required: 4.5 },
    { pair: '次要文字／米白底', fg: COLORS.inkMuted, bg: COLORS.cream, required: 4.5 },
    { pair: '主要按鈕文字／深綠', fg: COLORS.creamRaised, bg: COLORS.brandDeep, required: 4.5 },
    { pair: '標題／米白底', fg: COLORS.brandDeep, bg: COLORS.cream, required: 4.5 },
    { pair: '成功狀態／米白底', fg: COLORS.success, bg: COLORS.cream, required: 4.5 },
    { pair: '警告狀態／米白底', fg: COLORS.warning, bg: COLORS.cream, required: 4.5 },
    { pair: '錯誤狀態／米白底', fg: COLORS.danger, bg: COLORS.cream, required: 4.5 },
    { pair: '焦點外框／米白底', fg: COLORS.focusRing, bg: COLORS.cream, required: 3 },
  ];
  return pairs.map((p) => {
    const ratio = contrastRatio(p.fg, p.bg);
    return { pair: p.pair, ratio: Math.round(ratio * 100) / 100, required: p.required, passes: ratio >= p.required };
  });
}

/** 產生 CSS 變數，供 apps/web 直接注入。 */
export function cssVariables(): string {
  const lines: string[] = [':root {'];
  for (const [key, value] of Object.entries(COLORS)) {
    lines.push(`  --jp-color-${kebab(key)}: ${value};`);
  }
  for (const [key, value] of Object.entries(SPACING)) lines.push(`  --jp-space-${kebab(key)}: ${value};`);
  for (const [key, value] of Object.entries(FONT_SIZE)) lines.push(`  --jp-font-${kebab(key)}: ${value};`);
  for (const [key, value] of Object.entries(TARGET_SIZE)) lines.push(`  --jp-target-${kebab(key)}: ${value};`);
  for (const [key, value] of Object.entries(RADIUS)) lines.push(`  --jp-radius-${kebab(key)}: ${value};`);
  lines.push(`  --jp-line-body: ${String(LINE_HEIGHT.body)};`);
  lines.push(`  --jp-line-heading: ${String(LINE_HEIGHT.heading)};`);
  lines.push(`  --jp-focus-width: ${FOCUS.outlineWidth};`);
  lines.push(`  --jp-focus-offset: ${FOCUS.outlineOffset};`);
  lines.push(`  --jp-max-content: ${LAYOUT.maxContentWidth};`);
  lines.push('}');
  return lines.join('\n');
}

function kebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
