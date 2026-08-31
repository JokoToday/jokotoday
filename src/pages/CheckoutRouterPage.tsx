import { useEffect, useState } from 'react';
import CheckoutPage from './CheckoutPage';
import CheckoutPageV2 from './CheckoutPageV2';
import { getPickupV2CustomerEnabled } from '../lib/pickupV2Rollout';

interface CheckoutRouterPageProps {
  onNavigate: (page: string) => void;
}

export default function CheckoutRouterPage({ onNavigate }: CheckoutRouterPageProps) {
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

  if (pickupV2Enabled === null) {
    return <div className="min-h-[40vh]" aria-busy="true" />;
  }

  return pickupV2Enabled
    ? <CheckoutPageV2 onNavigate={onNavigate} />
    : <CheckoutPage onNavigate={onNavigate} />;
}
