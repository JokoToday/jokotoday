import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ShoppingBag, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

const POPULAR_SECTION_ID = 'popular-right-now';

type WelcomeBackCardProps = {
  onNavigate: (page: string) => void;
};

type SupportedLanguage = 'en' | 'th' | 'zh';

type WelcomeBackCopy = {
  welcome: (name: string) => string;
  question: string;
  continueCart: string;
  startShopping: string;
  seeWhatsNew: string;
  popularNow: string;
  dismiss: string;
};

type WelcomeBackClaim = {
  userId: string;
  promise: Promise<boolean>;
};

const COPY: Record<SupportedLanguage, WelcomeBackCopy> = {
  en: {
    welcome: (name) => `Welcome back, ${name}`,
    question: 'What would you like to do today?',
    continueCart: 'Continue your cart',
    startShopping: 'Start shopping',
    seeWhatsNew: "See what's new",
    popularNow: 'Popular right now',
    dismiss: 'Not now',
  },
  th: {
    welcome: (name) => `ยินดีต้อนรับกลับมา ${name}`,
    question: 'วันนี้อยากทำอะไรดี?',
    continueCart: 'กลับไปที่ตะกร้า',
    startShopping: 'เริ่มเลือกสินค้า',
    seeWhatsNew: 'ดูของใหม่',
    popularNow: 'ยอดนิยมตอนนี้',
    dismiss: 'ไว้ก่อน',
  },
  zh: {
    welcome: (name) => `欢迎回来，${name}`,
    question: '今天想做什么？',
    continueCart: '继续购物车',
    startShopping: '开始选购',
    seeWhatsNew: '看看新品',
    popularNow: '当前热门',
    dismiss: '暂时不用',
  },
};

function getDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0] || trimmed;
}

async function claimAccountWelcomeBack(): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_welcome_back_visit');

  if (error) {
    // Fail closed: a missing/unavailable RPC must never block the homepage or
    // fall back to browser-local heuristics that can misidentify a customer.
    console.error('Welcome Back eligibility check failed:', error.message);
    return false;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return Boolean(row && typeof row === 'object' && row.show_welcome === true);
}

export function WelcomeBackCard({ onNavigate }: WelcomeBackCardProps) {
  const { user, userProfile, userRole, loading, profileLoading } = useAuth();
  const { language } = useLanguage();
  const {
    totalItems,
    setIsCartOpen,
    setSelectedCategory,
  } = useCart();
  const [visible, setVisible] = useState(false);
  const claimRef = useRef<WelcomeBackClaim | null>(null);

  const copy = COPY[(language === 'th' || language === 'zh' ? language : 'en') as SupportedLanguage];
  const displayName = useMemo(
    () => getDisplayName(userProfile?.name || ''),
    [userProfile?.name],
  );

  useEffect(() => {
    if (loading || profileLoading) return;

    // AuthContext deliberately represents only privileged roles in userRole.
    // A completed authenticated profile with userRole === null is therefore a
    // customer; admin/staff accounts must never receive the customer welcome.
    if (
      !user ||
      !userProfile ||
      !userProfile.profile_completed ||
      userRole !== null
    ) {
      claimRef.current = null;
      setVisible(false);
      return;
    }

    // The server owns return cadence and visit history. Reuse one in-flight
    // claim if AuthContext causes this effect to re-run so React StrictMode or a
    // profile refresh cannot consume the server-side claim twice.
    if (!claimRef.current || claimRef.current.userId !== user.id) {
      claimRef.current = {
        userId: user.id,
        promise: claimAccountWelcomeBack(),
      };
    }

    let active = true;
    const claim = claimRef.current.promise;
    void claim.then((shouldShow) => {
      if (active) setVisible(shouldShow);
    });

    return () => {
      active = false;
    };
  }, [loading, profileLoading, user, userProfile, userRole]);

  if (!visible || !user || !userProfile) return null;

  const dismiss = () => setVisible(false);

  const openProducts = () => {
    dismiss();
    setSelectedCategory('all');
    onNavigate('products');
  };

  const continuePrimaryAction = () => {
    dismiss();
    if (totalItems > 0) {
      setIsCartOpen(true);
      return;
    }
    setSelectedCategory('all');
    onNavigate('products');
  };

  const openPopular = () => {
    dismiss();
    const target = document.getElementById(POPULAR_SECTION_ID);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // If Most Loved is still loading, unavailable, or empty, go straight to
    // the catalogue. Avoid delayed retries that can fire after leaving Home.
    setSelectedCategory('all');
    onNavigate('products');
  };

  return (
    <aside
      aria-label={copy.welcome(displayName)}
      className="fixed inset-x-4 bottom-4 z-[60] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[360px]"
    >
      <div className="relative rounded-2xl border border-primary-100 bg-white/95 p-5 shadow-xl backdrop-blur-sm">
        <button
          type="button"
          onClick={dismiss}
          aria-label={copy.dismiss}
          className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="mb-2 pr-8 text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">
          JOKO TODAY
        </p>
        <h2 className="pr-8 font-header text-xl font-bold text-primary-900">
          {copy.welcome(displayName)}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          {copy.question}
        </p>

        <button
          type="button"
          onClick={continuePrimaryAction}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
        >
          {totalItems > 0 ? (
            <ShoppingBag className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {totalItems > 0 ? copy.continueCart : copy.startShopping}
        </button>

        <div className="mt-3 flex items-center justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={openProducts}
            className="font-medium text-primary-700 underline-offset-4 transition-colors hover:text-primary-900 hover:underline focus:outline-none focus:underline"
          >
            {copy.seeWhatsNew}
          </button>
          <span aria-hidden="true" className="text-primary-200">·</span>
          <button
            type="button"
            onClick={openPopular}
            className="font-medium text-primary-700 underline-offset-4 transition-colors hover:text-primary-900 hover:underline focus:outline-none focus:underline"
          >
            {copy.popularNow}
          </button>
        </div>
      </div>
    </aside>
  );
}

export default WelcomeBackCard;
