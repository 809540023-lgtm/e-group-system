import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, RADIUS, SPACING, renderButton, renderEmptyState, renderField, renderStatusBadge } from '@jp/ui';
import { SiteNav } from '../site-nav';

export const dynamic = 'force-dynamic';

const STATUS_TEXT: Readonly<Record<string, string>> = {
  pending_payment: '待付款',
  confirmed: '已成立',
  procuring: '採購中',
  ready_to_ship: '待出貨',
  cancelled: '已取消',
  exception: '異常處理中',
};

const PAYMENT_TEXT: Readonly<Record<string, string>> = {
  unpaid: '未付款',
  processing: '付款處理中',
  paid: '已付款',
  partially_refunded: '部分退款',
  refunded: '已退款',
  needs_review: '待人工核對',
};

const SHIPMENT_TEXT: Readonly<Record<string, string>> = {
  not_shipped: '未出貨',
  shipped: '已出貨',
  customs: '報關中',
  in_transit_tw: '臺灣配送中',
  delivered: '已送達',
  delivery_exception: '配送異常',
};

/**
 * 訂單查詢（規劃書 05 章；模組 07）。
 *
 * 顯示付款、採購、出貨、物流、異常與售後狀態。
 * 付款狀態同時以文字與符號表示，不只靠顏色。
 */
export default async function OrdersPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly orderCode?: string; readonly phone?: string; readonly error?: string }>;
}): Promise<ReactNode> {
  const query = await searchParams;
  const orderCode = query.orderCode ?? '';
  const phone = query.phone ?? '';

  return (
    <>
      <SiteNav current="/orders" />
      <main id="main">
        <h1 style={{ fontSize: FONT_SIZE.headingLarge, margin: `0 0 ${SPACING.md} 0` }}>訂單查詢</h1>
        <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>
          輸入訂單編號與下單時的手機末三碼，即可查看付款、採購、出貨、物流、異常與售後狀態。
        </p>

        {query.error !== undefined ? (
          <p role="alert" style={{ fontSize: FONT_SIZE.body, color: COLORS.danger, fontWeight: 700 }}>
            {query.error}
          </p>
        ) : null}

        <form method="get" action="/orders" style={{ marginTop: SPACING.lg, maxWidth: 560 }}>
          <div dangerouslySetInnerHTML={{ __html: renderField({ id: 'orderCode', label: '訂單編號', value: orderCode, required: true, hint: '例如 JP-2026-000123' }) }} />
          <div dangerouslySetInnerHTML={{ __html: renderField({ id: 'phone', label: '手機末三碼', value: phone, required: true, inputMode: 'numeric', hint: '僅用於核對身分，不會顯示完整號碼' }) }} />
          <div style={{ marginTop: SPACING.md }} dangerouslySetInnerHTML={{ __html: renderButton({ label: '查詢訂單', type: 'submit' }) }} />
        </form>

        <section style={{ marginTop: SPACING.xl }}>
          <h2 style={{ fontSize: FONT_SIZE.heading }}>狀態說明</h2>
          <ul style={{ fontSize: FONT_SIZE.body, lineHeight: 1.8 }}>
            <li>付款：{Object.values(PAYMENT_TEXT).join('、')}</li>
            <li>訂單：{Object.values(STATUS_TEXT).join('、')}</li>
            <li>出貨：{Object.values(SHIPMENT_TEXT).join('、')}</li>
          </ul>
          <div
            dangerouslySetInnerHTML={{
              __html: renderStatusBadge({ label: '待人工核對', tone: 'warning', description: '付款金額或交易號與訂單不符時，會先進入人工核對，不會直接出貨。' }),
            }}
          />
        </section>

        <section style={{ marginTop: SPACING.xl }}>
          <h2 style={{ fontSize: FONT_SIZE.heading }}>需要補資料或聯絡客服</h2>
          <div
            dangerouslySetInnerHTML={{
              __html: renderEmptyState({
                title: '找不到訂單或需要協助',
                description: '請準備訂單編號，透過客服表單或 LINE 官方帳號與我們聯絡。',
                actionLabel: '前往客服',
                actionHref: '/support',
              }),
            }}
          />
        </section>

        <p style={{ marginTop: SPACING.lg, fontSize: FONT_SIZE.caption, color: COLORS.inkMuted, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: SPACING.md }}>
          為保護個資，查詢結果不會顯示完整地址、電話或報關證件；需要修改收件資料時請聯絡客服。
        </p>
      </main>
    </>
  );
}
