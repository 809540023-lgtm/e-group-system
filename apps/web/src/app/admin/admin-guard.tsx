import type { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING } from '@jp/ui';
import type { Permission } from '@jp/domain';
import { describeAuthError, requireAdminPermission } from '@/lib/admin';
import { SiteNav } from '../site-nav';

/**
 * 後臺頁面守門（規劃書 03 章；模組 03）。
 *
 * 權限檢查一律在伺服器端執行；前端只負責顯示結果。
 */
export async function AdminGuard({
  permission,
  title,
  children,
}: {
  readonly permission: Permission;
  readonly title: string;
  readonly children: (context: Awaited<ReturnType<typeof requireAdminPermission>>) => ReactNode;
}): Promise<ReactNode> {
  try {
    const context = await requireAdminPermission(permission);
    return (
      <>
        <SiteNav />
        <main id="main">
          <h1 style={{ fontSize: FONT_SIZE.headingLarge, margin: `0 0 ${SPACING.md} 0` }}>{title}</h1>
          {children(context)}
        </main>
      </>
    );
  } catch (cause) {
    const error = describeAuthError(cause);
    return (
      <>
        <SiteNav />
        <main id="main">
          <h1 style={{ fontSize: FONT_SIZE.headingLarge, margin: `0 0 ${SPACING.md} 0` }}>{title}</h1>
          <p role="alert" style={{ fontSize: FONT_SIZE.body, color: COLORS.danger, fontWeight: 700 }}>
            {error.code === 'FORBIDDEN' ? `權限不足：${error.message}` : error.message}
          </p>
          <p style={{ fontSize: FONT_SIZE.body, color: COLORS.inkMuted }}>
            此頁面需要權限 <code>{permission}</code>。請聯絡擁有者調整角色。
          </p>
        </main>
      </>
    );
  }
}
