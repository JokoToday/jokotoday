import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function QRResolverPage({ qrToken }: { qrToken: string }) {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const resolveQR = async () => {
      try {
        if (!qrToken) {
          setStatus('error')
          setMessage('Missing QR token')
          return
        }

        console.log('🔎 Resolving QR token:', qrToken)

        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('id, role, short_code')
          .eq('qr_token', qrToken)
          .maybeSingle()

        if (error) throw error

        if (!profile) {
          setStatus('error')
          setMessage('QR not linked to any user')
          return
        }

        const { data: sessionData } = await supabase.auth.getSession()
        const session = sessionData.session

        if (session) {
          // Staff/admin side
          window.location.href = `/staff/resolve?code=${profile.short_code}`
        } else {
          // Customer side
          window.location.href = `/dashboard?code=${profile.short_code}`
        }
      } catch (err) {
        console.error('QR resolve error:', err)
        setStatus('error')
        setMessage('Failed to resolve QR code')
      }
    }

    resolveQR()
  }, [qrToken])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Resolving QR…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow text-center">
        <h2 className="text-xl font-bold mb-2">QR Error</h2>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}
