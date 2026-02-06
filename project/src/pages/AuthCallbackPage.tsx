import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildUrl } from '../lib/url'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const url = new URL(window.location.href)
        const shortCode = url.searchParams.get('short_code')
        const qrToken = url.searchParams.get('qr_token')

        console.log('🔐 Auth callback params:', { shortCode, qrToken })

        const { data, error } = await supabase.auth.getSession()

        if (error) throw error
        if (!data.session) throw new Error('No session found')

        const user = data.session.user
        console.log('✅ Auth session user:', user.email)

        // If QR login → attach short_code / qr_token to profile
        if (shortCode || qrToken) {
          const updates: Record<string, any> = {}
          if (shortCode) updates.short_code = shortCode
          if (qrToken) updates.qr_token = qrToken

          const { error: profileError } = await supabase
            .from('user_profiles')
            .update(updates)
            .eq('id', user.id)

          if (profileError) {
            console.error('Profile update failed:', profileError)
          } else {
            console.log('✅ Profile updated from QR login')
          }
        }

        // Redirect after auth
        navigate(buildUrl('/'))
      } catch (err) {
        console.error('Auth callback failed:', err)
        navigate(buildUrl('/'))
      }
    }

    handleAuth()
  }, [navigate])

  return (
    <div style={{ padding: 24 }}>
      <h2>Signing you in…</h2>
      <p>Please wait while we complete your login.</p>
    </div>
  )
}
