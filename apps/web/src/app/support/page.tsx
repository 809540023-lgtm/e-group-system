import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, RADIUS, SPACING, renderButton, renderEmptyState, renderField } from '@jp/ui';
import { SiteNav } from '../site-nav';

export const dynamic = 'force-dynamic';

const FAQ: readonly { readonly question: string; readonly answer: string }[] = [
  {
    question: '日本預購大約多久會到貨？',
    answer: '預購商品需先向日本下單，通常 7 至 21 個工作天抵臺，實際到貨時間以商品頁標示的到貨區間為準。',
  },
  {
    question: '運費怎麼計算？',
    answer: '結帳第二步會列出商品金額、運費與其他費用，不會隱藏運費。臺灣本島宅配與超商取貨運費相同，日本集運另計。',
  },
  {
    question: '可以指定到貨時間嗎？',
    answer: '宅配可於備註填寫希望時段，實際配送仍依物流公司安排。',
  },
  {
    question: '付款後可以取消或退款嗎？',
    answer: '未出貨前可申請取消；已向日本下單的預購商品，需視供應商是否接受取消。退款金額不會超過實際已付款金額。',
  },
  {
    question: '需要提供報關證件嗎？',
    answer: '部分保健食品或高價商品進口時需要報關資料，我們會先以客服訊息說明需要哪些資料，不會在群組索取。',
  },
  {
    question: '商品有問題怎麼辦？',
    answer: '請於收到商品 7 日內透過客服表單或 LINE 官方帳號提出，附上訂單編號與照片，我們會建立案件編號並回覆處理進度。',
  },
];

const HOURS: readonly { readonly day: string; readonly time: string }[] = [
  { day: '週一至週五', time: '09:00 - 18:00' },
  { day: '週六', time: '10:00 - 16:00' },
  { day: '週日與國定假日', time: '休息（訊息仍會收到，次一工作日回覆）' },
];

/**
 * 客服（規劃書 05、17 章；模組 17）。
 *
 * 常見問題、工作時間、案件編號及回覆進度。
 * 表單送出後會建立案件編號，並顯示首次回覆時限。
 */
export default async function SupportPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly ticket?: string; readonly error?: string }>;
}): Promise<ReactNode> {
  const query = await searchParams;

  return (
    <>
      <SiteNav current="/support" />
      <main id="main">
        <h1 style={{ fontSize: FONT_SIZE.headingLarge, margin: `0 0 ${SPACING.md} 0` }}>客服</h1>
        <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>
          常見問題、工作時間、案件編號及回覆進度。送出後會取得案件編號，可用來追蹤進度。
        </p>

        {query.ticket !== undefined ? (
          <p role="status" style={{ fontSize: FONT_SIZE.body, color: COLORS.success, fontWeight: 700 }}>
            已收到您的訊息，案件編號：{query.ticket}。我們會在 8 小時內首次回覆。
          </p>
        ) : null}
        {query.error !== undefined ? (
          <p role="alert" style={{ fontSize: FONT_SIZE.body, color: COLORS.danger, fontWeight: 700 }}>
            {query.error}
          </p>
        ) : null}

        <section style={{ marginTop: SPACING.xl }}>
          <h2 style={{ fontSize: FONT_SIZE.heading }}>常見問題</h2>
          <dl style={{ fontSize: FONT_SIZE.body, lineHeight: 1.8 }}>
            {FAQ.map((item) => (
              <div key={item.question} style={{ marginBottom: SPACING.md }}>
                <dt style={{ fontWeight: 700 }}>{item.question}</dt>
                <dd style={{ margin: `${SPACING.xs} 0 0 0`, color: COLORS.inkMuted }}>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section style={{ marginTop: SPACING.xl }}>
          <h2 style={{ fontSize: FONT_SIZE.heading }}>工作時間</h2>
          <table style={{ fontSize: FONT_SIZE.body, borderCollapse: 'collapse' }}>
            <caption style={{ textAlign: 'left', color: COLORS.inkMuted, fontSize: FONT_SIZE.caption }}>客服工作時間（臺北時間）</caption>
            <tbody>
              {HOURS.map((row) => (
                <tr key={row.day} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <th scope="row" style={{ textAlign: 'left', padding: SPACING.sm }}>
                    {row.day}
                  </th>
                  <td style={{ padding: SPACING.sm }}>{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={{ marginTop: SPACING.xl, maxWidth: 640 }}>
          <h2 style={{ fontSize: FONT_SIZE.heading }}>留下訊息</h2>
          <form method="post" action="/api/support/tickets">
            <div dangerouslySetInnerHTML={{ __html: renderField({ id: 'orderCode', label: '訂單編號（若與訂單相關）', hint: '沒有訂單也可以直接填寫問題' }) }} />
            <div dangerouslySetInnerHTML={{ __html: renderField({ id: 'contact', label: '聯絡方式', required: true, hint: '手機或 LINE ID，僅用於回覆此案件' }) }} />
            <div dangerouslySetInnerHTML={{ __html: renderField({ id: 'category', label: '問題類型', required: true, hint: '例如：付款、出貨、退換貨、商品諮詢' }) }} />
            <div dangerouslySetInnerHTML={{ __html: renderField({ id: 'message', label: '問題描述', type: 'textarea', required: true, hint: '請描述遇到的狀況，若有照片可於回覆時提供' }) }} />
            <div style={{ marginTop: SPACING.md }} dangerouslySetInnerHTML={{ __html: renderButton({ label: '送出訊息', type: 'submit' }) }} />
          </form>
        </section>

        <section style={{ marginTop: SPACING.xl }}>
          <div
            dangerouslySetInnerHTML={{
              __html: renderEmptyState({
                title: '也可以透過 LINE 官方帳號',
                description: '加入官方帳號後可直接傳訊息，我們會建立案件編號並回覆進度。',
                actionLabel: '查看訂單狀態',
                actionHref: '/orders',
              }),
            }}
          />
        </section>

        <p style={{ marginTop: SPACING.lg, fontSize: FONT_SIZE.caption, color: COLORS.inkMuted, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: SPACING.md }}>
          我們不會在公開群組索取完整地址、電話或報關證件；需要這些資料時會以客服訊息個別說明。
        </p>
      </main>
    </>
  );
}
