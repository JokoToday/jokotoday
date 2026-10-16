import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { SourcingDisclosure } from '../components/MakerAttribution';
import { useEffect, useState } from 'react';
import CheckoutPage from './CheckoutPage';
import CheckoutPageV2 from './CheckoutPageV2';
import { useAuth } from '../context/AuthContext';
import { getPickupV2CustomerEnabled } from '../lib/pickupV2Rollout';
import { needsLINEEmailForCheckout } from '../lib/lineProfile';
import { EmailVerificationPanel } from '../components/EmailVerificationPanel';

interface CheckoutRouterPageProps {
  onNavigate: (page: string) => void;
}

export default function CheckoutRouterPage({ onNavigate }: CheckoutRouterPageProps) {
  const { language } = useLanguage();
  const { items } = useCart();
  const hasStoreItems = items.some((item) => item.product.catalog_scope === 'store_only');
  const hasMakers = items.some((item) => item.product.product_origin === 'maker');
  const { user, profileLoading } = useAuth();
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

  if (hasStoreItems) return <div className="joko-mineral-field min-h-[60vh] px-4 py-12"><div role="alert" className="mx-auto max-w-xl rounded-2xl bg-[#FFF9EE] p-6"><h2 className="mb-3 text-xl font-semibold">JOKO Store ordering is coming soon</h2><p>Store items can be added to My Cart for preview, but they cannot be ordered or paid for until stock reservations and delivery fees have been verified. Remove Store items to continue with an eligible Bakery order.</p><button type="button" className="mt-4 rounded-lg bg-[#55766F] px-4 py-2 text-white" onClick={() => onNavigate('store')}>Return to JOKO Store</button></div></div>;

  // Protect BOTH checkout versions. This is an onboarding UX gate;
  // the order submission paths recheck Supabase Auth separately.
  if (needsLINEEmailForCheckout(user)) {
    return (
      <div className="joko-mineral-field min-h-[70vh] px-4 py-12">
        <div className="mx-auto max-w-xl rounded-[2rem] bg-[#FFF9EE] p-6 sm:p-8">
          <EmailVerificationPanel forCheckout />
        </div>
      </div>
    );
  }

  if (hasMakers && !pickupV2Enabled) return <div className="mx-auto max-w-xl px-4 py-12"><SourcingDisclosure /><p>{language === 'th' ? 'การสั่งซื้อ Makers ต้องใช้ระบบเลือกวันรับสินค้า กรุณานำสินค้า Makers ออกจากตะกร้าชั่วคราว' : language === 'zh' ? 'Makers 订购需要指定取货日期。请暂时从购物篮中移除 Makers 商品。' : 'Makers ordering requires dated pickup checkout. Please return to your basket and remove the Makers items for now.'}</p><button className="mt-4 underline" onClick={() => onNavigate('products')}>{language === 'th' ? 'กลับไปดูสินค้า' : language === 'zh' ? '返回商品' : 'Back to products'}</button></div>;
  return pickupV2Enabled
    ? <CheckoutPageV2 onNavigate={onNavigate} />
    : <CheckoutPage onNavigate={onNavigate} />;
}
