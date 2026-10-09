import { describe, expect, it } from 'vitest';
import { twd } from '@jp/domain';
import {
  auditContrast,
  auditElement,
  auditPage,
  auditZoom200,
  COLORS,
  contrastRatio,
  cssVariables,
  DEFAULT_NAVIGATION,
  ELDER_TASKS,
  escapeHtml,
  FONT_SIZE,
  relativeLuminance,
  renderButton,
  renderCheckoutProgress,
  renderEmptyState,
  renderErrorSummary,
  renderFeeBreakdown,
  renderField,
  renderNavigation,
  renderPageShell,
  renderProductCard,
  renderQuantityStepper,
  renderStatusBadge,
  summarizeElderUsability,
  TARGET_SIZE,
  UI_METRICS,
} from '../src/index.ts';

describe('設計權杖', () => {
  it('正文 20px、商品名 ≥22px、價格 28–32px、按鈕 ≥48px', () => {
    expect(UI_METRICS.bodyFontSizePx).toBe(20);
    expect(UI_METRICS.productNameFontSizePx).toBeGreaterThanOrEqual(22);
    expect(UI_METRICS.priceFontSizePx).toBeGreaterThanOrEqual(28);
    expect(UI_METRICS.priceFontSizePx).toBeLessThanOrEqual(32);
    expect(UI_METRICS.minTargetPx).toBeGreaterThanOrEqual(48);
    expect(FONT_SIZE.priceSmall).toBe('28px');
    expect(TARGET_SIZE.min).toBe('48px');
  });

  it('深綠與米白配色存在', () => {
    expect(COLORS.brandDeep).toMatch(/^#[0-9A-F]{6}$/);
    expect(COLORS.cream).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('相對亮度與對比計算正確', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('非法色碼被拒絕', () => {
    expect(() => relativeLuminance('red')).toThrow(/INVALID_COLOR/);
    expect(() => relativeLuminance('#FFF')).toThrow(/INVALID_COLOR/);
  });

  it('所有關鍵文字／底色組合達 WCAG 2.2 AA', () => {
    const checks = auditContrast();
    expect(checks.length).toBeGreaterThanOrEqual(8);
    for (const check of checks) {
      expect(check.passes, `${check.pair} 對比 ${String(check.ratio)} 未達 ${String(check.required)}`).toBe(true);
    }
  });

  it('cssVariables 產生深綠與米白變數', () => {
    const css = cssVariables();
    expect(css).toContain('--jp-color-brand-deep: #1F4D3A');
    expect(css).toContain('--jp-color-cream: #FBF7EF');
    expect(css).toContain('--jp-font-body: 20px');
    expect(css).toContain('--jp-target-min: 48px');
    expect(css.trimEnd().endsWith('}')).toBe(true);
  });
});

describe('無障礙稽核', () => {
  it('按鈕高度不足 48px 被標記', () => {
    const issues = auditElement({ tag: 'button', text: '送出', heightPx: 40, hasVisibleFocus: true });
    expect(issues.map((i) => i.rule)).toContain('target-size');
  });

  it('缺少可存取名稱被標記', () => {
    const issues = auditElement({ tag: 'button', text: '   ', heightPx: 48, hasVisibleFocus: true });
    expect(issues.map((i) => i.rule)).toContain('accessible-name');
  });

  it('缺少可見焦點被標記', () => {
    const issues = auditElement({ tag: 'a', text: '連結', heightPx: 48, hasVisibleFocus: false });
    expect(issues.map((i) => i.rule)).toContain('focus-visible');
  });

  it('圖片缺少 alt 被標記', () => {
    const issues = auditElement({ tag: 'img', isImage: true, isInteractive: false });
    expect(issues.map((i) => i.rule)).toContain('image-alt');
  });

  it('狀態只以顏色表示被標記', () => {
    const issues = auditElement({ tag: 'span', isInteractive: false, statusColorOnly: true });
    expect(issues.map((i) => i.rule)).toContain('status-not-color-only');
  });

  it('合規元素沒有問題', () => {
    expect(auditElement({ tag: 'button', text: '加入購物車', heightPx: 48, hasVisibleFocus: true })).toEqual([]);
    expect(auditElement({ tag: 'img', isImage: true, isInteractive: false, alt: '商品圖' })).toEqual([]);
  });

  it('頁面橫向滾動、字級不足、按鈕被遮住都被標記', () => {
    const issues = auditPage({
      viewportWidthPx: 390,
      hasHorizontalScroll: true,
      bodyFontSizePx: 16,
      productNameFontSizePx: 18,
      priceFontSizePx: 24,
      primaryButtonHeightPx: 40,
      primaryButtonCoveredByFixedBar: true,
    });
    const rules = issues.map((i) => i.rule);
    expect(rules).toContain('no-horizontal-scroll');
    expect(rules).toContain('body-font-size');
    expect(rules).toContain('product-name-font-size');
    expect(rules).toContain('price-font-size');
    expect(rules).toContain('primary-button-height');
    expect(rules).toContain('button-not-covered');
  });

  it('自動輪播、搶焦點彈窗、隱藏運費、短倒數都被標記', () => {
    const issues = auditPage({
      viewportWidthPx: 1280,
      hasHorizontalScroll: false,
      bodyFontSizePx: 20,
      primaryButtonHeightPx: 48,
      hasAutoCarousel: true,
      hasFocusStealingModal: true,
      hidesShippingFee: true,
      hasCountdownTimer: true,
    });
    const rules = issues.map((i) => i.rule);
    expect(rules).toEqual(['no-auto-carousel', 'no-focus-stealing-modal', 'no-hidden-shipping', 'no-short-countdown']);
  });

  it('合規頁面沒有問題', () => {
    expect(
      auditPage({
        viewportWidthPx: 390,
        hasHorizontalScroll: false,
        bodyFontSizePx: 20,
        productNameFontSizePx: 24,
        priceFontSizePx: 30,
        primaryButtonHeightPx: 48,
      }),
    ).toEqual([]);
  });

  it('200% 字型不得橫向滾動', () => {
    expect(auditZoom200({ viewportWidthPx: 390, hasHorizontalScroll: false })).toEqual([]);
    expect(auditZoom200({ viewportWidthPx: 390, hasHorizontalScroll: true })[0]?.rule).toBe('zoom-200-no-horizontal-scroll');
  });
});

describe('長者可用性紀錄', () => {
  it('五個驗收任務齊全', () => {
    expect(ELDER_TASKS.map((t) => t.id)).toEqual(['find-product', 'choose-spec', 'add-to-cart', 'confirm-total', 'check-order']);
  });

  it('至少三位長者才算達標', () => {
    const two = summarizeElderUsability([
      { taskId: 'find-product', participantId: 'p1', completed: true, seconds: 30, stuckAt: null, helpCount: 0 },
      { taskId: 'find-product', participantId: 'p2', completed: true, seconds: 40, stuckAt: null, helpCount: 1 },
    ]);
    expect(two.meetsMinimumParticipants).toBe(false);
    expect(two.participants).toBe(2);

    const three = summarizeElderUsability([
      { taskId: 'find-product', participantId: 'p1', completed: true, seconds: 30, stuckAt: null, helpCount: 0 },
      { taskId: 'choose-spec', participantId: 'p2', completed: false, seconds: 60, stuckAt: '規格選單', helpCount: 2 },
      { taskId: 'add-to-cart', participantId: 'p3', completed: true, seconds: 20, stuckAt: null, helpCount: 0 },
    ]);
    expect(three.meetsMinimumParticipants).toBe(true);
    expect(three.completionRate).toBeCloseTo(0.667, 2);
    expect(three.averageSeconds).toBeCloseTo(36.7, 1);
    expect(three.totalHelpCount).toBe(2);
  });

  it('沒有紀錄時不除以零', () => {
    const report = summarizeElderUsability([]);
    expect(report.completionRate).toBe(0);
    expect(report.averageSeconds).toBe(0);
    expect(report.meetsMinimumParticipants).toBe(false);
  });
});

describe('元件輸出', () => {
  it('escapeHtml 跳脫所有危險字元', () => {
    expect(escapeHtml(`<script>alert("x")&'y'</script>`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;y&#39;&lt;/script&gt;');
  });

  it('按鈕高度至少 48px 且有可存取名稱', () => {
    const html = renderButton({ label: '加入購物車' });
    expect(html).toContain('min-height:48px');
    expect(html).toContain('aria-label="加入購物車"');
    expect(html).toContain('type="button"');
  });

  it('處理中按鈕停用並標示 aria-busy', () => {
    const html = renderButton({ label: '前往付款', busy: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled');
    expect(html).toContain('處理中');
  });

  it('連結型按鈕輸出 a 標籤', () => {
    const html = renderButton({ label: '回商品列表', href: '/categories', variant: 'secondary' });
    expect(html).toContain('<a href="/categories"');
    expect(html).toContain('min-height:48px');
  });

  it('狀態徽章同時提供文字與符號', () => {
    const html = renderStatusBadge({ label: '已付款', tone: 'success', description: '付款完成' });
    expect(html).toContain('已付款');
    expect(html).toContain('✓');
    expect(html).toContain('aria-label="已付款：付款完成"');
  });

  it('數量加減有文字與符號', () => {
    const html = renderQuantityStepper({ name: 'qty', value: 2 });
    expect(html).toContain('減少');
    expect(html).toContain('增加');
    expect(html).toContain('inputmode="numeric"');
    expect(html).toContain('min-height:48px');
  });

  it('商品卡顯示名稱、售價、供貨方式與加入購物車', () => {
    const html = renderProductCard({
      title: '日本製面膜 30 片',
      spec: '30 片／盒',
      price: twd(348),
      supplyMode: 'in_stock',
      href: '/products/SKU-1',
      arrivalWindow: '1–3 個工作天',
      origin: '日本',
    });
    expect(html).toContain('日本製面膜 30 片');
    expect(html).toContain('NT$348');
    expect(html).toContain('臺灣現貨');
    expect(html).toContain('加入購物車');
    expect(html).toContain('到貨區間：1–3 個工作天');
    expect(html).toContain('產地：日本');
    expect(html).toContain('name="sku" value="SKU-1"');
  });

  it('未驗證基準價時不顯示原價折扣', () => {
    const withoutVerified = renderProductCard({ title: 'A', price: twd(100), supplyMode: 'preorder', href: '/products/A', originalPrice: twd(200) });
    expect(withoutVerified).not.toContain('原價');
    const withVerified = renderProductCard({ title: 'A', price: twd(100), supplyMode: 'preorder', href: '/products/A', originalPrice: twd(200), originalPriceVerified: true });
    expect(withVerified).toContain('原價 NT$200');
  });

  it('商品卡圖片有 alt', () => {
    const html = renderProductCard({ title: 'A', price: twd(100), supplyMode: 'inquiry', href: '/products/A', imageUrl: '/img/a.jpg' });
    expect(html).toContain('alt="A"');
    expect(html).toContain('loading="lazy"');
  });

  it('navigation 標示目前頁面並顯示購物車件數', () => {
    const html = renderNavigation([...DEFAULT_NAVIGATION.map((item) => (item.href === '/cart' ? { ...item, current: true } : item))], { cartCount: 3 });
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('購物車（3 件）');
    expect(html).toContain('aria-label="主要選單"');
  });

  it('結帳進度以文字表示狀態', () => {
    const html = renderCheckoutProgress([
      { index: 1, label: '收件資料', state: 'done' },
      { index: 2, label: '確認明細', state: 'current' },
      { index: 3, label: '付款', state: 'todo' },
    ]);
    expect(html).toContain('已完成');
    expect(html).toContain('進行中');
    expect(html).toContain('未開始');
  });

  it('費用明細包含運費與總額', () => {
    const html = renderFeeBreakdown(
      [
        { label: '商品合計', amount: twd(696) },
        { label: '運費', amount: twd(60), note: '本島常溫宅配' },
      ],
      twd(756),
    );
    expect(html).toContain('運費');
    expect(html).toContain('本島常溫宅配');
    expect(html).toContain('應付總額');
    expect(html).toContain('NT$756');
  });

  it('空狀態提供下一步', () => {
    const html = renderEmptyState({ title: '購物車是空的', description: '先挑選商品再加入購物車。', actionLabel: '看商品', actionHref: '/categories' });
    expect(html).toContain('role="status"');
    expect(html).toContain('href="/categories"');
  });

  it('錯誤摘要可聚焦並連到欄位', () => {
    const html = renderErrorSummary({ errors: [{ field: 'phone', message: '請填寫聯絡電話' }] });
    expect(html).toContain('role="alert"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('href="#phone"');
    expect(renderErrorSummary({ errors: [] })).toBe('');
  });

  it('表單欄位關聯標籤、提示與錯誤', () => {
    const html = renderField({ id: 'phone', label: '聯絡電話', type: 'tel', required: true, hint: '例如 0912345678', error: '格式不正確', inputMode: 'tel' });
    expect(html).toContain('for="phone"');
    expect(html).toContain('aria-describedby="phone-hint phone-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-required="true"');
    expect(html).toContain('inputmode="tel"');
  });

  it('頁面外殼含跳至主要內容、canonical 與發布版本', () => {
    const html = renderPageShell({
      title: '首頁',
      description: '日本日貨代購',
      navigation: [...DEFAULT_NAVIGATION],
      body: '<h1>近期商品</h1>',
      canonicalUrl: 'https://example.com/',
      publishedVersion: 'v1',
    });
    expect(html).toContain('lang="zh-Hant"');
    expect(html).toContain('跳到主要內容');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('jp-published-version');
    expect(html).toContain('font-size:20px');
    expect(html).toContain('prefers-reduced-motion');
  });

  it('使用者輸入被跳脫，不產生可執行標記', () => {
    const html = renderProductCard({ title: '<img src=x onerror=alert(1)>', price: twd(1), supplyMode: 'in_stock', href: '/products/x' });
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
