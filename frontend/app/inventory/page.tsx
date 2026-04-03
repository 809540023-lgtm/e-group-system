'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

interface InventoryItem {
  id: string
  product_name: string
  normalized_product_name: string
  category: string
  suggested_price: number
  review_status: string
  needs_review: boolean
  confidence: number
  created_at: string
}

export default function InventoryPage() {
  const router = useRouter()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          router.push('/auth/login')
          return
        }

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/inventory?page=${page}&status=${filter}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )

        setItems(response.data.items)
        setTotal(response.data.total)
      } catch (err: any) {
        if (err.response?.status === 401) {
          router.push('/auth/login')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()
  }, [page, filter, router])

  const getStatusBadge = (status: string) => {
    const styles = {
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    }
    return styles[status as keyof typeof styles] || styles.pending
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">商品管理</h1>

        {/* 篩選器 */}
        <div className="mb-6 flex gap-2">
          {['all', 'pending', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => { setFilter(s); setPage(1); }}
              className={`px-4 py-2 rounded ${
                filter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border'
              }`}
            >
              {s === 'all' ? '全部' : s === 'pending' ? '待審核' : s === 'approved' ? '已批准' : '已拒絕'}
            </button>
          ))}
        </div>

        {/* 表格 */}
        {loading ? (
          <div>載入中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">商品名稱</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">分類</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">估價</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">信心度</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">狀態</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{item.product_name}</td>
                    <td className="px-6 py-4 text-sm">{item.category}</td>
                    <td className="px-6 py-4 text-sm font-bold">${item.suggested_price}</td>
                    <td className="px-6 py-4 text-sm">{(item.confidence * 100).toFixed(0)}%</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(item.review_status)}`}>
                        {item.review_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-blue-600 hover:text-blue-800">
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 分頁 */}
        <div className="mt-6 flex justify-between items-center">
          <p className="text-sm text-gray-600">共 {total} 個商品</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border rounded disabled:bg-gray-100"
            >
              上一頁
            </button>
            <span className="px-4 py-2">{page}</span>
            <button
              onClick={() => setPage(page + 1)}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              下一頁
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
