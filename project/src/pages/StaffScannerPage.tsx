import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { QRScanner } from '../components/QRScanner'
import {
  Camera,
  User,
  Phone,
  MessageCircle,
  Package,
  Award,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { getPermissions } from '../lib/rolePermissions'
import { parseQRPayload } from '../lib/qrParser'

interface UserProfile {
  id: string
  name: string
  phone: string
  line_id: string | null
  whatsapp: string | null
  wechat_id: string | null
  short_code: string
  role: string
}

interface Order {
  id: string
  order_number: string
  order_items: any[]
  total_amount: number
  pickup_date: string
  status: string
  payment_status: string
  created_at: string
}

export function StaffScannerPage() {
  const { language } = useLanguage()
  const { userRole } = useAuth()
  const permissions = userRole ? getPermissions(userRole) : null

  const [showScanner, setShowScanner] = useState(false)
  const [customer, setCustomer] = useState<UserProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)

  const handleScan = async (decodedText: string) => {
    try {
      setLoading(true)
      setError(null)
      setCustomer(null)
      setOrders([])

      const parsed = parseQRPayload(decodedText)

      let shortCode: string | null = null

      if (parsed.kind === 'short_code') {
        shortCode = parsed.short_code
      } else if (parsed.kind === 'url') {
        const parts = parsed.url.split('/')
        shortCode = parts[parts.length - 1]?.toUpperCase() || null
      }

      if (!shortCode) {
        setError(language === 'en' ? 'Invalid QR code' : 'QR โค้ดไม่ถูกต้อง')
        return
      }

      console.log('🔍 Staff scan short_code:', shortCode)

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, name, phone, line_id, whatsapp, wechat_id, short_code, role')
        .eq('short_code', shortCode)
        .maybeSingle()

      if (profileError) throw profileError

      if (!profile) {
        setError(language === 'en' ? 'Member not found' : 'ไม่พบสมาชิก')
        return
      }

      setCustomer(profile)

      const today = new Date().toISOString().split('T')[0]

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', profile.id)
        .eq('pickup_date', today)
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      setOrders(ordersData || [])
    } catch (err) {
      console.error('Staff scan error:', err)
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  if (!permissions?.canAccessScanner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {language === 'en' ? 'Access Denied' : 'ไม่มีสิทธิ์เข้าถึง'}
          </h1>
          <p className="text-gray-600">
            {language === 'en'
              ? 'You do not have permission to access this page.'
              : 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-8 py-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              {language === 'en' ? 'Staff Scanner' : 'แสกน QR ลูกค้า'}
            </h1>
            <p className="text-slate-300">
              {language === 'en'
                ? 'Scan customer QR codes to manage orders'
                : 'สแกน QR โค้ดลูกค้าเพื่อจัดการคำสั่งซื้อ'}
            </p>
          </div>

          <div className="p-8">
            {!customer ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Camera className="w-10 h-10 text-slate-600" />
                </div>
                <button
                  onClick={() => setShowScanner(true)}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl"
                >
                  {language === 'en' ? 'Start Scanning' : 'เริ่มแสกน'}
                </button>
                {error && <p className="mt-4 text-red-600 font-medium">{error}</p>}
              </div>
            ) : (
              <div className="border-b border-gray-200 pb-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
                      <User className="w-8 h-8 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
                      <p className="text-amber-600 font-mono">{customer.short_code}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setCustomer(null)
                      setOrders([])
                      setError(null)
                    }}
                    className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                  >
                    {language === 'en' ? 'Scan Another' : 'แสกนต่อ'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          language={language as 'en' | 'th'}
        />
      )}
    </div>
  )
}
