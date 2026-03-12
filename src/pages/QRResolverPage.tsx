import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

type Props = {
  qrToken: string
}

export default function QRResolverPage({ qrToken }: Props) {
  const { signInWithQR } = useAuth()
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

        await signInWithQR(qrToken)
        window.location.href = '/'
      } catch (err) {
        console.error('QR login failed:', err)
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'QR login failed')
      }
    }

    resolveQR()
  }, [qrToken, signInWithQR])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Signing you in...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow text-center">
        <h2 className="text-xl font-bold mb-2">QR Error</h2>
        <p className="text-red-600">{message}</p>
      </div>
    </div>
  )
}
