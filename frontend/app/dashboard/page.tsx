'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DashboardData {
  total_items: number
  pending_review: number
  approved: number
  sold: number
  total_revenue: number
  active_listings: number
  timestamp: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          router.push('/auth/login')
          return
        }

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/dashboard/overview`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )

        setData(response.data)
      } catch (err: any) {
        if (err.response?.status === 401) {
          router.push('/auth/login')
        } else {
          setError('無法加載儀表板')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [router])

  if (loading) return <div className="p-8">載入中...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!data) return <div className="p-8">無數據</div>

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">儀表板</h1>

        {/* 統計卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm font-medium">總商品數</h3>
            <p className="text-3xl font-bold mt-2">{data.total_items}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm font-medium">待審核</h3>
            <p className="text-3xl font-bold mt-2 text-yellow-600">{data.pending_review}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm font-medium">已批准</h3>
            <p className="text-3xl font-bold mt-2 text-green-600">{data.approved}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm font-medium">已銷售</h3>
            <p className="text-3xl font-bold mt-2 text-blue-600">{data.sold}</p>
          </div>
        </div>

        {/* 銷售數據 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">總銷售額</h2>
            <p className="text-4xl font-bold text-green-600">
              ${data.total_revenue.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">在線上架</h2>
            <p className="text-4xl font-bold text-blue-600">{data.active_listings}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
