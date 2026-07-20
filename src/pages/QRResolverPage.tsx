import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { AuthModal } from '../components/AuthModal'
import { supabase } from '../lib/supabase'

type Props = {
  qrToken: string
}

type ErrorKind = 'invalid' | 'network'

const resolverText = {
  en: {
    loggingIn: 'Logging you in…',
    validating: 'Validating your QR code…',
    errorTitle: 'QR Error',
    invalid: "Hmm, we couldn't recognize that QR code. Please try again or log in with email.",
    network: 'We could not connect to the server. Please check your connection and try again.',
    existingSessionTitle: 'QR code not valid',
    existingSessionBody: 'This QR code could not be used to log in. You are still signed in with your existing account.',
    continueAccount: 'Continue to My Account',
    signOutAndRetry: 'Sign Out and Try Another QR',
  },
  th: {
    loggingIn: 'กำลังเข้าสู่ระบบ…',
    validating: 'กำลังตรวจสอบคิวอาร์โค้ด…',
    errorTitle: 'เกิดข้อผิดพลาดเกี่ยวกับคิวอาร์โค้ด',
    invalid: 'ขออภัย เราไม่สามารถตรวจสอบคิวอาร์โค้ดนี้ได้ โปรดลองอีกครั้งหรือเข้าสู่ระบบด้วยอีเมล',
    network: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
    existingSessionTitle: 'ไม่สามารถใช้คิวอาร์โค้ดนี้ได้',
    existingSessionBody: 'ไม่สามารถใช้คิวอาร์โค้ดนี้เพื่อเข้าสู่ระบบได้ คุณยังคงเข้าสู่ระบบด้วยบัญชีเดิมของคุณ',
    continueAccount: 'ไปยังบัญชีของฉัน',
    signOutAndRetry: 'ออกจากระบบและลองคิวอาร์โค้ดอื่น',
  },
  zh: {
    loggingIn: '正在为您登录…',
    validating: '正在验证二维码…',
    errorTitle: '二维码错误',
    invalid: '抱歉，我们无法识别此二维码。请重试或使用电子邮件登录。',
    network: '无法连接到服务器。请检查网络连接后重试。',
    existingSessionTitle: '二维码无效',
    existingSessionBody: '无法使用此二维码登录。您仍然通过原来的账户保持登录状态。',
    continueAccount: '继续前往我的账户',
    signOutAndRetry: '退出登录并尝试其他二维码',
  },
}

export default function QRResolverPage({ qrToken }: Props) {
  const loginStartedRef = useRef(false)
  const hadExistingSessionRef = useRef(false)
  const { signInWithQR } = useAuth()
  const { language } = useLanguage()
  const [status, setStatus] = useState<'validating' | 'logging_in' | 'error'>('validating')
  const [errorKind, setErrorKind] = useState<ErrorKind>('invalid')
  const [showQrLogin, setShowQrLogin] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const text = resolverText[language]

  useEffect(() => {
    if (loginStartedRef.current) return
    loginStartedRef.current = true

    const resolveQR = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const { data: { user }, error } = await supabase.auth.getUser(session.access_token)
        hadExistingSessionRef.current = Boolean(user && !error)
      }

      if (!qrToken) {
        setStatus('error')
        setErrorKind('invalid')
        return
      }

      setStatus('logging_in')
      try {
        await signInWithQR(qrToken)
        window.location.href = '/'
      } catch (error) {
        console.error('QR login failed:', error)
        const diagnostic = error instanceof Error ? error.message.toLowerCase() : ''
        setErrorKind(diagnostic.includes('fetch') || diagnostic.includes('network') ? 'network' : 'invalid')
        setStatus('error')
      }
    }

    resolveQR()
  }, [qrToken, signInWithQR])

  const handleSignOutAndRetry = async () => {
    if (signingOut) return
    setSigningOut(true)

    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out before QR retry failed:', error)
      setSigningOut(false)
      return
    }

    loginStartedRef.current = false
    hadExistingSessionRef.current = false
    setErrorKind('invalid')
    window.history.replaceState({}, '', '/')
    setShowQrLogin(true)
    setSigningOut(false)
  }

  if (showQrLogin) {
    return (
      <AuthModal
        isOpen
        initialAction="signin"
        onClose={() => { window.location.href = '/' }}
      />
    )
  }

  if (status !== 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">{status === 'validating' ? text.validating : text.loggingIn}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow text-center">
        <h2 className="text-xl font-bold mb-2">
          {hadExistingSessionRef.current ? text.existingSessionTitle : text.errorTitle}
        </h2>
        <p className="text-red-600">
          {hadExistingSessionRef.current ? text.existingSessionBody : text[errorKind]}
        </p>

        {hadExistingSessionRef.current && (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => { window.location.href = '/my-profile' }}
              className="rounded-lg bg-amber-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-amber-700"
            >
              {text.continueAccount}
            </button>
            <button
              type="button"
              onClick={handleSignOutAndRetry}
              disabled={signingOut}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {text.signOutAndRetry}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
