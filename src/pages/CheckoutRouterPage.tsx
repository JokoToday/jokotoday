import { useEffect, useState } from 'react';
import CheckoutPage from './CheckoutPage';
import CheckoutPageV2 from './CheckoutPageV2';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getPickupV2CustomerEnabled } from '../lib/pickupV2Rollout';

interface CheckoutRouterPageProps {
  onNavigate: (page: string) => void;
}

export default function CheckoutRouterPage({ onNavigate }: CheckoutRouterPageProps) {
  const { user, userRole, profileLoading } = useAuth();
  const { language, t } = useLanguage();
  const [pickupV2Enabled, setPickupV2Enabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getPickupV2CustomerEnabled().then((enabled) => {
      if (!cancelled) setPickupV2Enabled(enabled);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (pickupV2Enabled === null || (user && profileLoading)) {
    return <div className="min-h-[40vh]" aria-busy="true" />;
  }

  if (user && userRole) {
    const title = language === 'th'
      ? 'ต้องใช้บัญชีลูกค้าสำหรับการสั่งซื้อ'
      : language === 'zh'
        ? '下单需要客户账户'
        : 'Customer account required';
    const message = language === 'th'
      ? 'บัญชีแอดมินและพนักงานไม่สามารถสั่งซื้อผ่านหน้าชำระเงินของลูกค้าได้ กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้าเพื่อทดสอบหรือสั่งซื้อ'
      : language === 'zh'
        ? '管理员和员工账户不能通过客户结账流程下单。请使用客户账户登录后再测试或下单。'
        : 'Admin and staff accounts cannot place orders through customer checkout. Please sign in with a customer account to test or place an order.';

    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-background rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-primary-900 mb-4">{title}</h2>
          <p className="text-gray-600 mb-8">{message}</p>
          <button
            type="button"
            onClick={() => onNavigate('products')}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            {t.nav.products}
          </button>
        </div>
      </div>
    );
  }

  return pickupV2Enabled
    ? <CheckoutPageV2 onNavigate={onNavigate} />
    : <CheckoutPage onNavigate={onNavigate} />;
}
