import React, { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader2, ShoppingBag, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'
import { parseQRPayload } from '../lib/qrParser'

interface UserProfile {
  id: string
  name: string
  short_code: string
  role: string
  profile_picture_url: string | null
}

export function ScanPage() {
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'error'>('loading')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const { language } = useLanguage()

  useEffect(() => {
    const raw = window.location.href
    const parsed = parseQRPayload(raw)

    let shortCode: string | null = null

    if (parsed.kind === 'short_code') {
      shortCode = parsed.short_code
    } else if (parsed.kind === 'url') {
      const parts = parsed.url.split('/')
      shortCode = parts[parts.length - 1]?.toUpperCase() || null
    }

    if (!shortCode) {
      setStatus('not_found')
      setErrorMessage(language === 'th' ? 'ไม่พบรหัส' : 'No valid QR code')
      return
    }

    lookupUser(shortCode)
  }, [language])

  const lookupUser = async (shortCode: string) => {
    try {
      console.log('🔍 SCAN Lookup - short_code:', shortCode)
      console.log('   Using Supabase URL:', import.meta.env.VITE_SUPABASE_URL)

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, short_code, role, profile_picture_url')
        .eq('short_code', shortCode.trim())
        .maybeSingle()

      if (error) {
        setStatus('error')
        setErrorMessage(error.message)
        return
      }

      if (!data) {
        setStatus('not_found')
        setErrorMessage(language === 'th' ? 'ไม่พบสมาชิก' : 'Member not found')
        return
      }

      setUserProfile(data)
      setStatus('found')
    } catch (err) {
      setStatus('error')
      setErrorMessage(language === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred')
    }
  }

  const navigateTo = (path: string) => {
    window.location.href = path
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-amber-800 text-lg font-medium">
            {language === 'th' ? 'กำลังค้นหา...' : 'Looking up...'}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'not_found' || status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {language === 'th' ? 'ไม่พบข้อมูล' : 'Not Found'}
          </h1>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button
            onClick={() => navigateTo('/')}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {language === 'th' ? 'กลับหน้าแรก' : 'Go Home'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {language === 'th' ? 'ยินดีต้อนรับ!' : 'Welcome!'}
          </h1>
          <p className="text-xl font-semibold text-amber-700">{userProfile?.name}</p>
          <p className="text-amber-600 font-mono text-lg mt-1">{userProfile?.short_code}</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigateTo(`/pickup?code=${userProfile?.short_code}`)}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
          >
            <Package className="w-6 h-6" />
            <span>{language === 'th' ? 'รับออเดอร์' : 'Pickup Order'}</span>
          </button>

          <button
            onClick={() => navigateTo(`/walk-in?code=${userProfile?.short_code}`)}
            className="w-full bg-white hover:bg-gray-50 text-amber-700 font-semibold py-4 px-6 rounded-xl transition-all border-2 border-amber-200 flex items-center justify-center gap-3"
          >
            <ShoppingBag className="w-6 h-6" />
            <span>{language === 'th' ? 'ซื้อสินค้าหน้าร้าน' : 'Walk-in Purchase'}</span>
          </button>

          <button
            onClick={() => navigateTo('/')}
            className="w-full text-gray-500 hover:text-gray-700 font-medium py-3 transition-colors"
          >
            {language === 'th' ? 'กลับหน้าแรก' : 'Go Home'}
          </button>
        </div>
      </div>
    </div>
  )
}
