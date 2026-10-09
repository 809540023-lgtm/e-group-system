import type { ReactNode } from 'react';
import { DEFAULT_NAVIGATION, renderNavigation } from '@jp/ui';

/** 全站一致 navigation；主要入口保留首頁、商品分類、購物車、訂單查詢與客服。 */
export function SiteNav({ current }: { readonly current?: string }): ReactNode {
  const items = DEFAULT_NAVIGATION.map((item) => (item.href === current ? { ...item, current: true } : item));
  return <div dangerouslySetInnerHTML={{ __html: renderNavigation(items) }} />;
}
