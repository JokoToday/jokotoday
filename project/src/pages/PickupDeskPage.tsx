import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'

interface OrderItem {
  product_name: string
  quantity: number
}

interface Order {
  id: string
  order_number: string
  pickup_date: string
  order_items: OrderItem[]
}

export function PickupDeskPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { language } = useLanguage()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shortCode = params.get('code')

    if (!shortCode) {
      setLoading(false)
      setError(language === 'th' ? 'ไม่พบรหัสลูกค้า' : 'No customer code')
      return
    }

    fetchOrders(shortCode)
  }, [language])

  const fetchOrders = async (shortCode: string) => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔍 Pickup lookup short_code:', shortCode)

      // 1️⃣ Get customer profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('short_code', shortCode)
        .maybeSingle()

      if (profileError || !profile) {
        setError(language === 'th' ? 'ไม่พบลูกค้า' : 'Customer not found')
        setLoading(false)
        return
      }

      // 2️⃣ Get orders for today (or future)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, pickup_date, order_items')
        .eq('customer_id', profile.id)
        .order('pickup_date', { ascending: true })

      if (ordersError) throw ordersError

      setOrders(ordersData || [])
    } catch (err) {
      console.error('Pickup fetch error:', err)
      setError(language === 'th' ? 'เกิดข้อผิดพลาด' : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p className="p-4">Loading orders…</p>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        {language === 'th' ? 'ออเดอร์สำหรับรับสินค้า' : 'Pickup Orders'}
      </h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {orders.length === 0 && <p>No orders found.</p>}

      <ul className="space-y-4">
        {orders.map(order => (
          <li key={order.id} className="border p-4 rounded-xl">
            <div className="font-semibold">
              #{order.order_number} — {order.pickup_date}
            </div>
            <ul className="ml-4 list-disc">
              {order.order_items.map((item, idx) => (
                <li key={idx}>
                  {item.product_name} × {item.quantity}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
