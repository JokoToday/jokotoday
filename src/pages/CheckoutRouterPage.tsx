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

  return pickupV2Enabled
    ? <CheckoutPageV2 onNavigate={onNavigate} />
    : <CheckoutPage onNavigate={onNavigate} />;
}
