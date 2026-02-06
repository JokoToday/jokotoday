import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'

interface UserProfile {
  id: string
  name: string
  phone: string
  line_id: string | null
  whatsapp: string | null
  wechat_id: string | null
  short_code: string
}

export function WalkInDeskPage() {
  const { language } = useLanguage()
  const params = new URLSearchParams(window.location.search)
  const shortCode = params.get('code')

  const [customer, setCustomer] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!shortCode) {
      setLoading(false)
      setError(language === 'th' ? 'ไม่พบรหัสลูกค้า' : 'No customer code')
      return
    }

    fetchCustomer(shortCode)
  }, [shortCode, language])

  const fetchCustomer = async (code: string) => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔍 Walk-in lookup short_code:', code)

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, phone, line_id, whatsapp, wechat_id, short_code')
        .eq('short_code', code)
        .maybeSingle()

      if (error || !data) {
        setError(language === 'th' ? 'ไม่พบลูกค้า' : 'Customer not found')
        return
      }

      setCustomer(data)
    } catch (err) {
      console.error('Walk-in fetch error:', err)
      setError(language === 'th' ? 'เกิดข้อผิดพลาด' : 'Failed to load customer')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p className="p-4">Loading…</p>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        {language === 'th' ? 'ลูกค้า Walk-in' : 'Walk-in Customer'}
      </h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {!customer && !error && <p>No customer found.</p>}

      {customer && (
        <div className="border p-4 rounded-xl space-y-2">
          <p><strong>{language === 'th' ? 'ชื่อ' : 'Name'}:</strong> {customer.name}</p>
          <p><strong>{language === 'th' ? 'โทร' : 'Phone'}:</strong> {customer.phone}</p>
          <p><strong>Code:</strong> {customer.short_code}</p>
          {customer.line_id && <p>LINE: {customer.line_id}</p>}
          {customer.whatsapp && <p>WhatsApp: {customer.whatsapp}</p>}
          {customer.wechat_id && <p>WeChat: {customer.wechat_id}</p>}
        </div>
      )}
    </div>
  )
}
