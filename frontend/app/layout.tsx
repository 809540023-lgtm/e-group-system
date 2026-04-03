import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'E 組 - 庫存管理平台',
  description: '已購入商品入倉建檔管理系統',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
