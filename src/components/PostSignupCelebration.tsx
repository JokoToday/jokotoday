import { useEffect, useState } from 'react';
import { ShoppingBag, LayoutDashboard, Home, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface PostSignupCelebrationProps {
  qrToken: string;
  qrValue: string;
  onClose: () => void;
  onGoToProfile: () => void;
  shortCode?: string;
  onNavigate?: (page: string) => void;
}

const welcomeTranslations = {
  en: {
    welcome: 'Welcome!',
    subtitle: "You're now part of the JOKO TODAY family",
    description: 'Start exploring our fresh bakery items or manage your account.',
    browseCatalog: 'Browse Our Catalog',
    browseDescription: 'Discover our delicious selection',
    myDashboard: 'My Dashboard',
    dashboardDescription: 'View orders & QR code',
    homepage: 'Homepage',
    homepageDescription: 'Return to main page',
  },
  th: {
    welcome: 'ยินดีต้อนรับ!',
    subtitle: 'คุณเป็นส่วนหนึ่งของครอบครัว JOKO TODAY แล้ว',
    description: 'เริ่มสำรวจเบเกอรี่สดใหม่ของเราหรือจัดการบัญชีของคุณ',
    browseCatalog: 'ดูแคตตาล็อกสินค้า',
    browseDescription: 'ค้นพบเมนูอร่อยของเรา',
    myDashboard: 'แดชบอร์ดของฉัน',
    dashboardDescription: 'ดูคำสั่งซื้อและ QR Code',
    homepage: 'หน้าหลัก',
    homepageDescription: 'กลับไปหน้าแรก',
  },
  zh: {
    welcome: '欢迎!',
    subtitle: '您现在是 JOKO TODAY 家族的一员',
    description: '开始探索我们新鲜的烘焙产品或管理您的账户。',
    browseCatalog: '浏览目录',
    browseDescription: '发现我们的美味精选',
    myDashboard: '我的仪表板',
    dashboardDescription: '查看订单和二维码',
    homepage: '首页',
    homepageDescription: '返回主页',
  },
};

export function PostSignupCelebration({
  onClose,
  onGoToProfile,
  onNavigate,
}: PostSignupCelebrationProps) {
  const { language, setLanguage } = useLanguage();
  const [showContent, setShowContent] = useState(false);

  const t = welcomeTranslations[language] || welcomeTranslations.en;

  useEffect(() => {
    setShowContent(true);
  }, []);

  const handleBrowseCatalog = () => {
    if (onNavigate) {
      onNavigate('products');
    }
    onClose();
  };

  const handleDashboard = () => {
    onGoToProfile();
  };

  const handleHomepage = () => {
    if (onNavigate) {
      onNavigate('home');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .fade-in-up {
          animation: fadeInUp 0.5s ease-out forwards;
        }
        .scale-in {
          animation: scaleIn 0.4s ease-out forwards;
        }
        .bounce-gentle {
          animation: bounce 2s ease-in-out infinite;
        }
      `}</style>

      <div
        className={`bg-white rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full ${showContent ? 'scale-in' : 'opacity-0'}`}
      >
        <div className="relative bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-8 pb-12">
          <div className="absolute top-4 right-4">
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full p-1">
              <Globe className="w-4 h-4 text-white ml-2" />
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  language === 'en'
                    ? 'bg-white text-amber-600 shadow-sm'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('th')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  language === 'th'
                    ? 'bg-white text-amber-600 shadow-sm'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                TH
              </button>
              <button
                onClick={() => setLanguage('zh')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  language === 'zh'
                    ? 'bg-white text-amber-600 shadow-sm'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                ZH
              </button>
            </div>
          </div>

          <div className={`text-center ${showContent ? 'fade-in-up' : 'opacity-0'}`}>
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-5 shadow-lg bounce-gentle">
              <span className="text-5xl">🥐</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 drop-shadow-md">
              {t.welcome}
            </h1>
            <p className="text-white/90 text-lg font-medium">
              {t.subtitle}
            </p>
          </div>

          <div className="absolute -bottom-6 left-0 right-0 flex justify-center">
            <div className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
              <span className="text-2xl">✨</span>
            </div>
          </div>
        </div>

        <div className="px-6 pt-10 pb-8 bg-gradient-to-b from-gray-50 to-white">
          <p
            className={`text-center text-gray-600 mb-8 ${showContent ? 'fade-in-up' : 'opacity-0'}`}
            style={{ animationDelay: '0.1s' }}
          >
            {t.description}
          </p>

          <div className="space-y-4">
            <button
              onClick={handleBrowseCatalog}
              className={`w-full group relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl p-5 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] ${showContent ? 'fade-in-up' : 'opacity-0'}`}
              style={{ animationDelay: '0.2s' }}
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">{t.browseCatalog}</div>
                  <div className="text-white/80 text-sm">{t.browseDescription}</div>
                </div>
              </div>
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
            </button>

            <button
              onClick={handleDashboard}
              className={`w-full group relative overflow-hidden bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-2xl p-5 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] ${showContent ? 'fade-in-up' : 'opacity-0'}`}
              style={{ animationDelay: '0.3s' }}
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">{t.myDashboard}</div>
                  <div className="text-white/80 text-sm">{t.dashboardDescription}</div>
                </div>
              </div>
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
            </button>

            <button
              onClick={handleHomepage}
              className={`w-full group relative overflow-hidden bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white rounded-2xl p-5 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] ${showContent ? 'fade-in-up' : 'opacity-0'}`}
              style={{ animationDelay: '0.4s' }}
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Home className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">{t.homepage}</div>
                  <div className="text-white/80 text-sm">{t.homepageDescription}</div>
                </div>
              </div>
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
