import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, RADIUS, SPACING, TARGET_SIZE } from '@jp/ui';

export const metadata: Metadata = {
  title: '日本日貨代購',
  description: '日本日貨代購：商品整理、採購、臺灣銷售、金流、物流與客服使用同一組商品與訂單紀錄。',
};

const globalCss = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; background:${COLORS.cream}; color:${COLORS.ink}; font-size:${FONT_SIZE.body}; line-height:1.6;
    font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif; }
  a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
    outline:3px solid ${COLORS.focusRing}; outline-offset:2px; }
  main { max-width:1120px; margin:0 auto; padding:${SPACING.lg} ${SPACING.md} ${SPACING.xxl}; }
  .jp-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:${SPACING.md}; }
  .jp-button { cursor:pointer; font-family:inherit; }
  .jp-button[aria-disabled="true"] { opacity:0.6; cursor:not-allowed; }
  .jp-badge { display:inline-flex; align-items:center; gap:${SPACING.xs}; border:2px solid; border-radius:${RADIUS.pill};
    padding:2px ${SPACING.sm}; font-size:${FONT_SIZE.caption}; font-weight:600; }
  .jp-skip { position:absolute; left:-9999px; top:0; background:${COLORS.brandDeep}; color:${COLORS.creamRaised};
    padding:${SPACING.sm} ${SPACING.md}; min-height:${TARGET_SIZE.min}; display:inline-flex; align-items:center; }
  .jp-skip:focus { left:0; }
  @media (max-width: 480px) { .jp-grid { grid-template-columns:1fr; } }
  @media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important; } }
`;

export default function RootLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <html lang="zh-Hant">
      <head>
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      </head>
      <body>
        <a className="jp-skip" href="#main">
          跳到主要內容
        </a>
        {children}
      </body>
    </html>
  );
}
