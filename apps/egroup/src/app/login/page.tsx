import Link from 'next/link';
import { Field, Notice } from '../../components/ui.tsx';
import { loginAction, registerAction } from '../../lib/actions.ts';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const mode = params.mode === 'register' ? 'register' : 'login';
  const error = typeof params.error === 'string' ? params.error : undefined;
  const ok = typeof params.ok === 'string' ? params.ok : undefined;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand" style={{ borderBottom: 'none', paddingBottom: 8 }}>
          <span className="brand-mark">EG</span>
          <span>
            <span className="brand-name">健康餐食節點網路</span>
            <span className="brand-sub">雙北捷運生活圈</span>
          </span>
        </div>

        <h1 style={{ marginTop: 8 }}>{mode === 'register' ? '建立會員帳號' : '登入工作台'}</h1>
        <p className="muted small" style={{ marginTop: 6 }}>
          {mode === 'register'
            ? '註冊後即可選購、累積推薦點數，並在結帳時自動檢查過敏原。'
            : '顧客、供應商、加盟站點與總部使用同一個入口。'}
        </p>

        {error !== undefined ? <div style={{ marginTop: 14 }}><Notice tone="danger">{error}</Notice></div> : null}
        {ok !== undefined ? <div style={{ marginTop: 14 }}><Notice tone="ok">{ok}</Notice></div> : null}

        {mode === 'register' ? (
          <form action={registerAction} className="form" style={{ marginTop: 18 }}>
            <Field label="姓名"><input name="name" required autoComplete="name" /></Field>
            <div className="form-row">
              <Field label="電子郵件"><input name="email" type="email" required autoComplete="email" /></Field>
              <Field label="手機"><input name="phone" autoComplete="tel" placeholder="0912-000-000" /></Field>
            </div>
            <Field label="密碼" hint="至少 8 碼"><input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
            <Field label="過敏原" hint="以逗號分隔，例如：花生, 牛奶">
              <input name="allergens" placeholder="花生, 牛奶" />
            </Field>
            <button type="submit" className="btn btn-primary">建立帳號</button>
            <p className="muted small">
              已有帳號？<Link href="/login">回登入</Link>
            </p>
          </form>
        ) : (
          <form action={loginAction} className="form" style={{ marginTop: 18 }}>
            <Field label="電子郵件"><input name="email" type="email" required autoComplete="email" defaultValue="customer@egroup.tw" /></Field>
            <Field label="密碼"><input name="password" type="password" required autoComplete="current-password" defaultValue="demo1234" /></Field>
            <button type="submit" className="btn btn-primary">登入</button>
            <p className="muted small">
              還沒有帳號？<Link href="/login?mode=register">建立會員帳號</Link>
            </p>
          </form>
        )}

        <div className="demo-accounts">
          <div className="muted tiny" style={{ marginTop: 8 }}>示範帳號（密碼皆為 <code>demo1234</code>）</div>
          <div>顧客：<code>customer@egroup.tw</code></div>
          <div>供應商：<code>supplier@egroup.tw</code></div>
          <div>站點：<code>station@egroup.tw</code></div>
          <div>總部：<code>admin@egroup.tw</code></div>
        </div>
      </div>
    </div>
  );
}
