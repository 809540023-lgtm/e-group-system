import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { NavLink } from '../components/nav-link.tsx';
import { logoutAction } from '../lib/actions.ts';
import { getSession } from '../lib/auth.ts';
import { ROLE_LABELS } from '../lib/format.ts';
import './globals.css';

export const metadata: Metadata = {
  title: 'EG 健康餐食節點網路',
  description: '雙北捷運健康餐食節點網路：顧客、供應商、加盟站點、總部與資產管理。',
};

interface NavItem {
  href: string;
  label: string;
}

function navFor(role: string | null): { group: string; items: NavItem[] }[] {
  if (role === 'supplier') {
    return [
      { group: '供應商', items: [
        { href: '/supplier', label: '營運總覽' },
        { href: '/supplier/products', label: '商品與標示' },
        { href: '/supplier/batches', label: '批次管理' },
        { href: '/supplier/documents', label: '檢驗文件' },
        { href: '/supplier/shipments', label: '出貨管理' },
        { href: '/supplier/exceptions', label: '異常處理' },
      ] },
    ];
  }
  if (role === 'station') {
    return [
      { group: '站點營運', items: [
        { href: '/station', label: '營運總覽' },
        { href: '/station/receive', label: '收貨驗收' },
        { href: '/station/temperature', label: '冷鏈溫度' },
        { href: '/station/inventory', label: '庫存批次' },
        { href: '/station/deliver', label: '取貨核銷' },
        { href: '/station/heating', label: '加熱紀錄' },
        { href: '/station/quarantine', label: '隔離與召回' },
        { href: '/station/settlement', label: '服務結算' },
        { href: '/station/training', label: '人員訓練' },
      ] },
    ];
  }
  if (role === 'admin') {
    return [
      { group: '總部', items: [
        { href: '/admin', label: '營運儀表板' },
        { href: '/admin/procurement', label: '採購管理' },
        { href: '/admin/replenishment', label: '補貨預測' },
        { href: '/admin/pricing', label: '商品定價' },
        { href: '/admin/stations', label: '站點治理' },
        { href: '/admin/quality', label: '品質與召回' },
        { href: '/admin/referrals', label: '推薦獎勵' },
        { href: '/admin/reconciliation', label: '對帳結算' },
        { href: '/admin/audit', label: '稽核軌跡' },
        { href: '/admin/staff', label: '人員帳號' },
        { href: '/admin/ai', label: 'AI 客服' },
        { href: '/assets', label: '資產管理' },
      ] },
    ];
  }
  return [
    { group: '顧客', items: [
      { href: '/', label: '首頁' },
      { href: '/products', label: '選購餐食' },
      { href: '/stations', label: '取貨站點' },
      { href: '/cart', label: '購物車' },
      { href: '/orders', label: '我的訂單' },
      { href: '/recalls', label: '召回公告' },
      { href: '/account', label: '會員中心' },
    ] },
  ];
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const groups = navFor(session?.role ?? null);

  return (
    <html lang="zh-Hant">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <Link href="/" className="brand" style={{ textDecoration: 'none' }}>
              <span className="brand-mark">EG</span>
              <span>
                <span className="brand-name">健康餐食節點</span>
                <span className="brand-sub">雙北捷運生活圈</span>
              </span>
            </Link>

            <nav className="nav">
              {groups.map((group) => (
                <div key={group.group}>
                  <div className="nav-group">{group.group}</div>
                  {group.items.map((item) => (
                    <NavLink key={item.href} href={item.href}>
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>

            <div className="footer-note">
              食品安全優先。召回中商品不得透過任何管道銷售或交付；AI 不得解除召回、修改保存期限、核准投資或診斷疾病。
            </div>
          </aside>

          <main className="main">
            <div className="topbar">
              <div className="muted small">
                {session === null ? '訪客模式' : `${ROLE_LABELS[session.role] ?? session.role}工作台`}
              </div>
              {session === null ? (
                <Link href="/login" className="btn btn-primary btn-sm">登入 / 註冊</Link>
              ) : (
                <div className="row">
                  <div className="user-chip">
                    <span className="avatar">{session.displayName.slice(0, 1)}</span>
                    <span>{session.displayName}</span>
                    <span className="muted tiny">{session.email}</span>
                  </div>
                  <form action={logoutAction}>
                    <button type="submit" className="btn btn-sm btn-ghost">登出</button>
                  </form>
                </div>
              )}
            </div>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
