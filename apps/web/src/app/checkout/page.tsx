import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, RADIUS, SPACING, renderButton, renderCheckoutProgress, renderEmptyState, renderErrorSummary, renderFeeBreakdown, renderField, renderStatusBadge } from '@jp/ui';
import { formatMoney, twd } from '@jp/domain';
import { readCart } from '@/lib/cart';
import { resolveRepository } from '@/lib/catalog-db';
import { DEFAULT_SHIPPING_OPTIONS } from '@/lib/quote';
import { SiteNav } from '../site-nav';

export const dynamic = 'force-dynamic';

const STEPS = [
  { index: 1, label: '收件方式、地址及聯絡資料', state: 'current' as const },
  { index: 2, label: '確認明細與條款', state: 'todo' as const },
  { index: 3, label: '付款', state: 'todo' as const },
];

export default async function CheckoutPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly step?: string; readonly shipping?: string; readonly error?: string }>;
}): Promise<ReactNode> {
  const query = await searchParams;
  const step = query.step === '2' ? 2 : query.step === '3' ? 3 : 1;
  const shippingCode = query.shipping ?? DEFAULT_SHIPPING_OPTIONS[0]?.code ?? 'tw_home';
  const option = DEFAULT_SHIPPING_OPTIONS.find((o) => o.code === shippingCode) ?? DEFAULT_SHIPPING_OPTIONS[0];

  const lines = await readCart();
  const repo = await resolveRepository();
  const products = await Promise.all(lines.map((l) => repo.bySku(l.sku)));
  const rows = lines
    .map((line, index) => ({ line, product: products[index] ?? null }))
    .filter((row): row is { line: (typeof lines)[number]; product: NonNullable<(typeof products)[number]> } => row.product !== null);

  if (rows.length === 0) {
    return (
      <>
        <SiteNav />
        <main id="main">
          <h1 style={{ fontSize: FONT_SIZE.headingLarge }}>結帳</h1>
          <div
            dangerouslySetInnerHTML={{
              __html: renderEmptyState({
                title: '購物車是空的',
                description: '請先加入商品再結帳。',
                actionLabel: '看商品分類',
                actionHref: '/categories',
              }),
            }}
          />
        </main>
      </>
    );
  }

  const subtotal = rows.reduce((sum, row) => sum + row.product.saleTwd * row.line.quantity, 0);
  const shippingFee = option?.feeTwd ?? 0;
  const total = subtotal + shippingFee;
  const progress = renderCheckoutProgress(STEPS.map((s) => (s.index === step ? { ...s, state: 'current' as const } : s.index < step ? { ...s, state: 'done' as const } : s)));

  return (
    <>
      <SiteNav />
      <main id="main">
        <h1 style={{ fontSize: FONT_SIZE.headingLarge, margin: `0 0 ${SPACING.md} 0` }}>結帳</h1>
        <div dangerouslySetInnerHTML={{ __html: progress }} />

        {query.error === undefined ? null : (
          <div
            dangerouslySetInnerHTML={{
              __html: renderErrorSummary({ errors: [{ field: 'checkout', message: query.error }] }),
            }}
          />
        )}

        {step === 1 ? (
          <form method="post" action="/api/checkout/step1">
            <h2 style={{ fontSize: FONT_SIZE.heading }}>第一步：收件方式、地址及聯絡資料</h2>
            <fieldset style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: SPACING.md }}>
              <legend style={{ fontSize: FONT_SIZE.body }}>收件方式</legend>
              {DEFAULT_SHIPPING_OPTIONS.map((o) => (
                <label key={o.code} style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, minHeight: '48px', fontSize: FONT_SIZE.body }}>
                  <input type="radio" name="shipping" value={o.code} defaultChecked={o.code === shippingCode} style={{ width: '24px', height: '24px' }} />
                  {o.label}（運費 {formatMoney(twd(o.feeTwd))}，{o.promisedWindow}）
                </label>
              ))}
            </fieldset>
            <div style={{ marginTop: SPACING.md }}>
              <div dangerouslySetInnerHTML={{ __html: renderField({ id: 'recipient', label: '收件人姓名', required: true, autocomplete: 'name' }) }} />
              <div dangerouslySetInnerHTML={{ __html: renderField({ id: 'phone', label: '聯絡電話', type: 'tel', required: true, inputMode: 'tel', autocomplete: 'tel', hint: '例如 0912345678' }) }} />
              <div dangerouslySetInnerHTML={{ __html: renderField({ id: 'address', label: '收件地址', required: true, autocomplete: 'street-address', hint: '超商取貨請填門市名稱與地址' }) }} />
              <div dangerouslySetInnerHTML={{ __html: renderField({ id: 'note', label: '備註（選填）', type: 'textarea' }) }} />
            </div>
            <div dangerouslySetInnerHTML={{ __html: renderButton({ label: '下一步：確認明細', type: 'submit' }) }} />
          </form>
        ) : null}

        {step === 2 ? (
          <section>
            <h2 style={{ fontSize: FONT_SIZE.heading }}>第二步：確認明細與條款</h2>
            <ul style={{ fontSize: FONT_SIZE.body }}>
              {rows.map(({ line, product }) => (
                <li key={line.sku}>
                  {product.titleZh} × {line.quantity} = {formatMoney(twd(product.saleTwd * line.quantity))}
                </li>
              ))}
            </ul>
            <div
              dangerouslySetInnerHTML={{
                __html: renderFeeBreakdown(
                  [
                    { label: '商品合計', amount: twd(subtotal) },
                    { label: '運費', amount: twd(shippingFee), note: option?.label ?? '' },
                    { label: '稅費說明', amount: twd(0), note: '依現行規定，售價已含應由賣方負擔之稅費；進口關稅若產生將另行說明。' },
                  ],
                  twd(total),
                ),
              }}
            />
            <p style={{ fontSize: FONT_SIZE.caption, color: COLORS.inkMuted }}>
              送出後將產生 15 分鐘有效的報價；逾時需重新確認價格與可售量。
            </p>
            <form method="post" action="/api/checkout/step2">
              <input type="hidden" name="shipping" value={shippingCode} />
              <label style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, minHeight: '48px', fontSize: FONT_SIZE.body }}>
                <input type="checkbox" name="terms" value="agree" required style={{ width: '24px', height: '24px' }} />
                我已閱讀並同意代購條款（版本 {option?.code ?? ''}）
              </label>
              <div dangerouslySetInnerHTML={{ __html: renderButton({ label: '下一步：付款', type: 'submit' }) }} />
            </form>
          </section>
        ) : null}

        {step === 3 ? (
          <section>
            <h2 style={{ fontSize: FONT_SIZE.heading }}>第三步：付款</h2>
            <p style={{ fontSize: FONT_SIZE.body }}>
              應付總額：<strong style={{ fontSize: FONT_SIZE.priceSmall, color: COLORS.brandDeep }}>{formatMoney(twd(total))}</strong>
            </p>
            <div
              dangerouslySetInnerHTML={{
                __html: renderStatusBadge({ label: '尚未付款', tone: 'warning', description: '請選擇付款方式完成付款' }),
              }}
            />
            <form method="post" action="/api/checkout/pay" style={{ marginTop: SPACING.md }}>
              <input type="hidden" name="shipping" value={shippingCode} />
              <fieldset style={{ border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: SPACING.md }}>
                <legend style={{ fontSize: FONT_SIZE.body }}>付款方式</legend>
                <label style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, minHeight: '48px', fontSize: FONT_SIZE.body }}>
                  <input type="radio" name="method" value="Credit" defaultChecked style={{ width: '24px', height: '24px' }} />
                  信用卡（立即付款）
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, minHeight: '48px', fontSize: FONT_SIZE.body }}>
                  <input type="radio" name="method" value="ATM" style={{ width: '24px', height: '24px' }} />
                  ATM 轉帳（3 日內完成）
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, minHeight: '48px', fontSize: FONT_SIZE.body }}>
                  <input type="radio" name="method" value="CVS" style={{ width: '24px', height: '24px' }} />
                  超商代碼（7 日內完成）
                </label>
              </fieldset>
              <div style={{ marginTop: SPACING.md }} dangerouslySetInnerHTML={{ __html: renderButton({ label: '前往付款', type: 'submit' }) }} />
            </form>
            <p style={{ fontSize: FONT_SIZE.caption, color: COLORS.inkMuted }}>
              按下付款後按鈕會停用並顯示處理中；重試沿用同一訂單，不會重複扣款。
            </p>
          </section>
        ) : null}
      </main>
    </>
  );
}
