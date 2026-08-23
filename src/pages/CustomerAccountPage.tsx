import { useEffect, useState } from 'react';
import { ArrowLeft, Heart, Loader2, LogOut, Package, QrCode, Star, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

interface CustomerAccountPageProps {
  qrToken: string;
  onNavigate: (page: string) => void;
}

export function CustomerAccountPage({ qrToken, onNavigate }: CustomerAccountPageProps) {
  const { user, userProfile, loading: authLoading, profileLoading, signOut } = useAuth();
  const { language } = useLanguage();
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(false);

  const copy = language === 'th'
    ? {
        title: 'บัญชี JOKO TODAY ของฉัน',
        subtitle: 'จัดการโปรไฟล์ คำสั่งซื้อ รายการโปรด และคิวอาร์สมาชิกจากที่เดียว',
        profile: 'โปรไฟล์ของฉัน',
        orders: 'คำสั่งซื้อของฉัน',
        favorites: 'รายการโปรด',
        qr: 'คิวอาร์สมาชิก',
        points: 'คะแนนสะสม',
        back: 'กลับหน้าหลัก',
        logout: 'ออกจากระบบ',
        signIn: 'กรุณาเข้าสู่ระบบเพื่อดูบัญชีของคุณ',
        wrongCode: 'คิวอาร์นี้ไม่ตรงกับบัญชีที่เข้าสู่ระบบ',
      }
    : language === 'zh'
      ? {
          title: '我的 JOKO TODAY 账户',
          subtitle: '在一个地方管理个人资料、订单、收藏和会员二维码。',
          profile: '我的资料',
          orders: '我的订单',
          favorites: '我的收藏',
          qr: '会员二维码',
          points: '会员积分',
          back: '返回首页',
          logout: '退出登录',
          signIn: '请登录以查看您的账户。',
          wrongCode: '此二维码与当前登录的账户不匹配。',
        }
      : {
          title: 'My JOKO TODAY Account',
          subtitle: 'Manage your profile, orders, favorites and member QR from one place.',
          profile: 'My Profile',
          orders: 'My Orders',
          favorites: 'My Favorites',
          qr: 'Member QR',
          points: 'Loyalty Points',
          back: 'Back to Home',
          logout: 'Sign Out',
          signIn: 'Please sign in to view your account.',
          wrongCode: 'This QR code does not match the signed-in account.',
        };

  const tokenMatchesProfile = Boolean(
    userProfile
    && (qrToken === userProfile.qr_token || qrToken.toUpperCase() === userProfile.short_code?.toUpperCase())
  );

  useEffect(() => {
    if (!user || !tokenMatchesProfile) {
      setLoyaltyPoints(0);
      return;
    }

    let active = true;
    setLoadingPoints(true);
    supabase
      .from('customers')
      .select('loyalty_points')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Error loading loyalty points:', error);
          return;
        }
        setLoyaltyPoints(Number(data?.loyalty_points) || 0);
      })
      .finally(() => {
        if (active) setLoadingPoints(false);
      });

    return () => {
      active = false;
    };
  }, [user, tokenMatchesProfile]);

  const handleSignOut = async () => {
    await signOut();
    onNavigate('home');
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <UserCircle className="w-14 h-14 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-700 mb-6">{copy.signIn}</p>
          <button onClick={() => onNavigate('home')} className="w-full bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-700">{copy.back}</button>
        </div>
      </div>
    );
  }

  if (!tokenMatchesProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <QrCode className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <p className="text-gray-800 font-semibold mb-2">{copy.wrongCode}</p>
          <p className="text-sm text-gray-500 mb-6">{userProfile.short_code || ''}</p>
          <button onClick={() => onNavigate('home')} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-black">{copy.back}</button>
        </div>
      </div>
    );
  }

  const cards = [
    { key: 'profile', label: copy.profile, icon: UserCircle, page: 'profile' },
    { key: 'orders', label: copy.orders, icon: Package, page: 'orders' },
    { key: 'favorites', label: copy.favorites, icon: Heart, page: 'favorites' },
    { key: 'qr', label: copy.qr, icon: QrCode, page: 'my-qr' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <button onClick={() => onNavigate('home')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
            <ArrowLeft className="w-4 h-4" /> {copy.back}
          </button>
          <button onClick={handleSignOut} className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 font-medium">
            <LogOut className="w-4 h-4" /> {copy.logout}
          </button>
        </div>

        <section className="bg-white rounded-3xl shadow-xl border border-amber-100 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-8">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-white/20 border border-white/40 overflow-hidden flex items-center justify-center shrink-0">
                {userProfile.profile_picture_url
                  ? <img src={userProfile.profile_picture_url} alt={userProfile.name || 'Profile'} className="w-full h-full object-cover" />
                  : <UserCircle className="w-12 h-12" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-amber-100 font-semibold tracking-wide">{userProfile.short_code}</p>
                <h1 className="text-3xl font-bold truncate">{userProfile.name || copy.title}</h1>
                <p className="text-amber-50 mt-1">{copy.subtitle}</p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="mb-7 rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 fill-current" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold">{copy.points}</p>
                <p className="text-2xl font-extrabold text-amber-900">{loadingPoints ? '…' : loyaltyPoints.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {cards.map(({ key, label, icon: Icon, page }) => (
                <button
                  key={key}
                  onClick={() => onNavigate(page)}
                  className="p-5 rounded-2xl border border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50 hover:shadow-md transition-all text-left flex items-center gap-4"
                >
                  <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-gray-900">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
