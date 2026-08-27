import { useEffect, useMemo, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type StaffLanguage = 'en' | 'th';

type Reward = {
  id: string;
  name_en: string;
  name_th: string;
  reward_type: 'fixed_discount' | 'percentage_discount' | 'free_product' | 'free_item' | 'custom';
  points_required: number;
  fixed_discount_amount: number | null;
  percentage_discount: number | null;
  max_discount_amount: number | null;
  minimum_order_amount: number;
};

type Props = {
  currentBalance: number;
  language: StaffLanguage;
  contextAmount: number;
  selectedRewardId: string;
  onChange: (rewardId: string) => void;
};

const rewardDetail = (reward: Reward, language: StaffLanguage) => {
  if (reward.reward_type === 'fixed_discount' && reward.fixed_discount_amount) {
    return `฿${Number(reward.fixed_discount_amount).toFixed(2)} ${language === 'en' ? 'off' : 'ส่วนลด'}`;
  }
  if (reward.reward_type === 'percentage_discount' && reward.percentage_discount) {
    const cap = reward.max_discount_amount
      ? ` · ${language === 'en' ? 'max' : 'สูงสุด'} ฿${Number(reward.max_discount_amount).toFixed(2)}`
      : '';
    return `${Number(reward.percentage_discount).toFixed(0)}% ${language === 'en' ? 'off' : 'ส่วนลด'}${cap}`;
  }
  if (reward.reward_type === 'free_product') {
    return language === 'en'
      ? 'Free product — unavailable until inventory fulfillment is enabled'
      : 'สินค้าฟรี — ยังไม่พร้อมจนกว่าจะเชื่อมระบบสต็อก';
  }
  if (reward.reward_type === 'free_item') return language === 'en' ? 'Free goodie · staff fulfills manually' : 'ของแถมฟรี · พนักงานมอบให้';
  return language === 'en' ? 'Custom reward · staff fulfills manually' : 'รางวัลพิเศษ · พนักงานดำเนินการ';
};

export function LoyaltyRewardSelector({
  currentBalance,
  language,
  contextAmount,
  selectedRewardId,
  onChange,
}: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: rewardError } = await supabase
          .from('loyalty_rewards')
          .select('id, name_en, name_th, reward_type, points_required, fixed_discount_amount, percentage_discount, max_discount_amount, minimum_order_amount')
          .contains('channels', ['walk_in'])
          .order('sort_order', { ascending: true })
          .order('points_required', { ascending: true });
        if (rewardError) throw rewardError;
        if (active) setRewards((data || []) as Reward[]);
      } catch (err) {
        console.error('Could not load walk-in loyalty rewards:', err);
        if (active) {
          setError(language === 'en' ? 'Rewards are temporarily unavailable.' : 'ไม่สามารถโหลดรางวัลได้ชั่วคราว');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [language]);

  const selectedReward = useMemo(
    () => rewards.find((reward) => reward.id === selectedRewardId) || null,
    [rewards, selectedRewardId]
  );

  useEffect(() => {
    if (!selectedReward) return;
    const invalid = selectedReward.reward_type === 'free_product'
      || selectedReward.points_required > currentBalance
      || Number(selectedReward.minimum_order_amount || 0) > contextAmount;
    if (invalid) onChange('');
  }, [selectedReward, currentBalance, contextAmount, onChange]);

  if (loading) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {language === 'en' ? 'Loading loyalty rewards…' : 'กำลังโหลดรางวัลสะสมแต้ม…'}
      </div>
    );
  }

  if (error) return <p className="text-sm font-medium text-red-600">{error}</p>;
  if (rewards.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-amber-700" />
        <div>
          <p className="font-bold text-gray-900">{language === 'en' ? 'Use a loyalty reward' : 'ใช้รางวัลสะสมแต้ม'}</p>
          <p className="text-xs text-amber-800">
            {language === 'en'
              ? 'Optional. The reward is applied in the same transaction as this sale.'
              : 'ไม่บังคับ รางวัลจะถูกใช้พร้อมกับการบันทึกการขายในรายการเดียวกัน'}
          </p>
        </div>
      </div>

      <select
        value={selectedRewardId}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-sm text-gray-900"
      >
        <option value="">{language === 'en' ? 'No reward' : 'ไม่ใช้รางวัล'}</option>
        {rewards.map((reward) => {
          const disabled = reward.reward_type === 'free_product'
            || reward.points_required > currentBalance
            || Number(reward.minimum_order_amount || 0) > contextAmount;
          const suffix = reward.reward_type === 'free_product'
            ? (language === 'en' ? ' · inventory pending' : ' · รอระบบสต็อก')
            : reward.points_required > currentBalance
              ? (language === 'en' ? ' · not enough points' : ' · แต้มไม่พอ')
              : Number(reward.minimum_order_amount || 0) > contextAmount
                ? (language === 'en' ? ' · minimum not met' : ' · ยอดไม่ถึงขั้นต่ำ')
                : '';
          return (
            <option key={reward.id} value={reward.id} disabled={disabled}>
              {language === 'th' ? reward.name_th : reward.name_en} — {reward.points_required} pts{suffix}
            </option>
          );
        })}
      </select>

      {selectedReward && (
        <div className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">{language === 'th' ? selectedReward.name_th : selectedReward.name_en}</p>
              <p className="mt-1 text-gray-600">{rewardDetail(selectedReward, language)}</p>
              {Number(selectedReward.minimum_order_amount || 0) > 0 && (
                <p className="mt-1 text-gray-500">
                  {language === 'en' ? 'Minimum purchase' : 'ยอดซื้อขั้นต่ำ'}: ฿{Number(selectedReward.minimum_order_amount).toFixed(2)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-gray-500">{language === 'en' ? 'Points' : 'แต้ม'}</p>
              <p className="font-bold text-amber-700">{currentBalance} → {currentBalance - selectedReward.points_required}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
