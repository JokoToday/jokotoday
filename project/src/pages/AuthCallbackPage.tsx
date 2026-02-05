import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildUrl } from '../lib/url'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Auth callback error:', error)
        navigate('/')
        return
      }

      if (!data.session) {
        console.warn('No session found after auth callback')
        navigate('/')
        return
      }

      console.log('✅ Auth session established:', data.session.user.email)

      // After login / confirm → go home or dashboard
      navigate('/')
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
