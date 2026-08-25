import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Check, ChevronDown, Gift, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type StaffLanguage = 'en' | 'th';
type RedemptionChannel = 'pickup' | 'walk_in';

type Reward = {
  id: string;
  reward_key: string;
  name_en: string;
  name_th: string;
  reward_type: 'fixed_discount' | 'percentage_discount' | 'free_product' | 'free_item' | 'custom';
  points_required: number;
  fixed_discount_amount: number | null;
  percentage_discount: number | null;
  max_discount_amount: number | null;
  minimum_order_amount: number;
  product_id: string | null;
};

type PickupOrderOption = {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
};

type RedemptionResult = {
  redemption_id: string;
  reward_id: string;
  reward_key: string;
  reward_type: string;
  reward_name_en: string;
  reward_name_th: string;
  points_spent: number;
  previous_balance: number;
  new_balance: number;
  channel: RedemptionChannel;
  order_id: string | null;
  context_amount: number | null;
  discount_amount: number | null;
  request_key: string;
  idempotent_replay: boolean;
};

type Props = {
  customerId: string;
  currentBalance: number;
  channel: RedemptionChannel;
  language: StaffLanguage;
  contextAmount?: number | null;
  walkInOrderId?: string | null;
  pickupOrders?: PickupOrderOption[];
  onRedeemed: (result: RedemptionResult) => void;
};

const needsOrderContext = (reward: Reward) => (
  reward.reward_type === 'fixed_discount'
  || reward.reward_type === 'percentage_discount'
  || Number(reward.minimum_order_amount || 0) > 0
);

export function LoyaltyRewardRedemption({
  customerId,
  currentBalance,
  channel,
  language,
  contextAmount = null,
  walkInOrderId = null,
  pickupOrders = [],
  onRedeemed,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [selectedRewardId, setSelectedRewardId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    let active = true;

    const loadRewards = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: rewardError } = await supabase
          .from('loyalty_rewards')
          .select('id, reward_key, name_en, name_th, reward_type, points_required, fixed_discount_amount, percentage_discount, max_discount_amount, minimum_order_amount, product_id')
          .contains('channels', [channel])
          .order('sort_order', { ascending: true })
          .order('points_required', { ascending: true });
        if (rewardError) throw rewardError;
        if (active) setRewards((data || []) as Reward[]);
      } catch (err) {
        console.error('Could not load loyalty rewards:', err);
        if (active) {
          setError(language === 'en'
            ? 'Rewards are temporarily unavailable.'
            : 'ไม่สามารถโหลดรางวัลได้ชั่วคราว');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadRewards();
    return () => { active = false; };
  }, [expanded, channel, language]);

  const selectedReward = useMemo(
    () => rewards.find((reward) => reward.id === selectedRewardId) || null,
    [rewards, selectedRewardId]
  );

  const selectedOrder = useMemo(
    () => pickupOrders.find((order) => order.id === selectedOrderId) || null,
    [pickupOrders, selectedOrderId]
  );

  useEffect(() => {
    requestKeyRef.current = null;
  }, [selectedRewardId, selectedOrderId, contextAmount, walkInOrderId]);

  const balanceAfter = selectedReward
    ? currentBalance - selectedReward.points_required
    : currentBalance;

  const orderRequired = Boolean(selectedReward && channel === 'pickup' && needsOrderContext(selectedReward));
  const insufficient = Boolean(selectedReward && balanceAfter < 0);
  const monetaryContextMissing = Boolean(
    selectedReward
    && ['fixed_discount', 'percentage_discount'].includes(selectedReward.reward_type)
    && (channel === 'pickup' ? !selectedOrder : !walkInOrderId)
  );
  const minimumNotMet = Boolean(
    selectedReward
    && channel === 'walk_in'
    && Number(selectedReward.minimum_order_amount || 0) > Number(contextAmount || 0)
  );

  const rewardDetail = (reward: Reward) => {
    if (reward.reward_type === 'fixed_discount' && reward.fixed_discount_amount) {
      return `฿${Number(reward.fixed_discount_amount).toFixed(2)} ${language === 'en' ? 'off' : 'ส่วนลด'}`;
    }
    if (reward.reward_type === 'percentage_discount' && reward.percentage_discount) {
      const cap = reward.max_discount_amount
        ? ` · ${language === 'en' ? 'max' : 'สูงสุด'} ฿${Number(reward.max_discount_amount).toFixed(2)}`
        : '';
      return `${Number(reward.percentage_discount).toFixed(0)}% ${language === 'en' ? 'off' : 'ส่วนลด'}${cap}`;
    }
    if (reward.reward_type === 'free_product') return language === 'en' ? 'Free product' : 'สินค้าฟรี';
    if (reward.reward_type === 'free_item') return language === 'en' ? 'Free goodie' : 'ของแถมฟรี';
    return language === 'en' ? 'Custom reward' : 'รางวัลพิเศษ';
  };

  const redeem = async () => {
    if (!selectedReward) return;
    if (orderRequired && !selectedOrder) {
      setError(language === 'en' ? 'Select the pickup order for this reward.' : 'กรุณาเลือกคำสั่งซื้อสำหรับรางวัลนี้');
      return;
    }
    if (insufficient || minimumNotMet || monetaryContextMissing) return;

    const requestKey = requestKeyRef.current ?? crypto.randomUUID();
    requestKeyRef.current = requestKey;

    try {
      setRedeeming(true);
      setError(null);
      setSuccess(null);
      const { data, error: redeemError } = await supabase.rpc('staff_redeem_loyalty_reward_v2', {
        p_customer_id: customerId,
        p_reward_id: selectedReward.id,
        p_channel: channel,
        p_order_id: channel === 'pickup' ? (selectedOrder?.id || null) : walkInOrderId,
        // Walk-In amount is display-only here. The RPC derives the authoritative
        // value from the persisted walk-in order selected above.
        p_context_amount: null,
        p_request_key: requestKey,
      });
      if (redeemError) throw redeemError;
      if (!data || typeof data.new_balance !== 'number' || typeof data.points_spent !== 'number') {
        throw new Error('Invalid redemption response');
      }

      const result = data as RedemptionResult;
      onRedeemed(result);
      const discountText = typeof result.discount_amount === 'number' && result.discount_amount > 0
        ? (language === 'en'
          ? ` Discount value: ฿${result.discount_amount.toFixed(2)}.`
          : ` มูลค่าส่วนลด ฿${result.discount_amount.toFixed(2)}`)
        : '';
      setSuccess(language === 'en'
        ? `${result.points_spent} points redeemed.${discountText} New balance: ${result.new_balance} points.`
        : `แลก ${result.points_spent} แต้มแล้ว${discountText} ยอดคงเหลือ ${result.new_balance} แต้ม`);
      requestKeyRef.current = null;
      setSelectedRewardId('');
      setSelectedOrderId('');
    } catch (err) {
      console.error('Could not redeem loyalty reward:', err);
      setError(err instanceof Error
        ? err.message
        : (language === 'en' ? 'Could not redeem reward.' : 'ไม่สามารถแลกรางวัลได้'));
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-amber-100 p-2">
            <Gift className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <p className="font-bold text-gray-900">{language === 'en' ? 'Redeem Reward' : 'แลกรางวัล'}</p>
            <p className="text-sm text-amber-800">
              {language === 'en' ? `${currentBalance} points available` : `มี ${currentBalance} แต้ม`}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-amber-700 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-amber-200 p-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              {language === 'en' ? 'Loading rewards…' : 'กำลังโหลดรางวัล…'}
            </div>
          ) : rewards.length === 0 ? (
            <p className="text-sm text-amber-800">
              {language === 'en' ? 'No rewards are currently available for this desk.' : 'ขณะนี้ไม่มีรางวัลสำหรับเคาน์เตอร์นี้'}
            </p>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-800">
                  {language === 'en' ? 'Reward' : 'รางวัล'}
                </label>
                <select
                  value={selectedRewardId}
                  onChange={(event) => {
                    setSelectedRewardId(event.target.value);
                    setSelectedOrderId('');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-sm text-gray-900"
                >
                  <option value="">{language === 'en' ? 'Select a reward…' : 'เลือกรางวัล…'}</option>
                  {rewards.map((reward) => (
                    <option key={reward.id} value={reward.id}>
                      {language === 'th' ? reward.name_th : reward.name_en} — {reward.points_required} pts
                    </option>
                  ))}
                </select>
              </div>

              {selectedReward && (
                <div className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{rewardDetail(selectedReward)}</p>
                      {Number(selectedReward.minimum_order_amount || 0) > 0 && (
                        <p className="mt-1 text-gray-600">
                          {language === 'en' ? 'Minimum purchase' : 'ยอดซื้อขั้นต่ำ'}: ฿{Number(selectedReward.minimum_order_amount).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-gray-500">{language === 'en' ? 'Balance' : 'แต้มคงเหลือ'}</p>
                      <p className={`font-bold ${insufficient ? 'text-red-600' : 'text-amber-700'}`}>
                        {currentBalance} → {Math.max(balanceAfter, 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedReward && channel === 'pickup' && pickupOrders.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-800">
                    {language === 'en' ? 'Pickup order' : 'คำสั่งซื้อ'}{orderRequired ? ' *' : ''}
                  </label>
                  <select
                    value={selectedOrderId}
                    onChange={(event) => setSelectedOrderId(event.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-sm text-gray-900"
                  >
                    <option value="">{language === 'en' ? 'No order / select order…' : 'ไม่ระบุ / เลือกคำสั่งซื้อ…'}</option>
                    {pickupOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        #{order.orderNumber} — ฿{Number(order.totalAmount || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedReward && channel === 'walk_in' && (
                <p className="text-sm text-gray-700">
                  {language === 'en' ? 'Current sale amount' : 'ยอดขายปัจจุบัน'}: ฿{Number(contextAmount || 0).toFixed(2)}
                </p>
              )}

              {insufficient && (
                <p className="text-sm font-semibold text-red-600">
                  {language === 'en' ? 'Customer does not have enough points.' : 'ลูกค้ามีแต้มไม่เพียงพอ'}
                </p>
              )}
              {minimumNotMet && selectedReward && (
                <p className="text-sm font-semibold text-red-600">
                  {language === 'en'
                    ? `Minimum purchase of ฿${Number(selectedReward.minimum_order_amount).toFixed(2)} is not met.`
                    : `ยอดซื้อยังไม่ถึงขั้นต่ำ ฿${Number(selectedReward.minimum_order_amount).toFixed(2)}`}
                </p>
              )}
              {monetaryContextMissing && selectedReward && (
                <p className="text-sm font-semibold text-red-600">
                  {language === 'en'
                    ? (channel === 'pickup' ? 'Select the pickup order to calculate this discount.' : 'Enter the sale amount before redeeming this discount.')
                    : (channel === 'pickup' ? 'กรุณาเลือกคำสั่งซื้อเพื่อคำนวณส่วนลด' : 'กรุณากรอกยอดขายก่อนแลกส่วนลด')}
                </p>
              )}
              {error && <p className="text-sm font-medium text-red-600">{error}</p>}
              {success && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
                  <Check className="h-4 w-4" />
                  {success}
                </div>
              )}

              <button
                type="button"
                onClick={() => void redeem()}
                disabled={!selectedReward || redeeming || insufficient || minimumNotMet || monetaryContextMissing || (orderRequired && !selectedOrder)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
              >
                {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                {selectedReward
                  ? (language === 'en' ? `Redeem ${selectedReward.points_required} points` : `แลก ${selectedReward.points_required} แต้ม`)
                  : (language === 'en' ? 'Select a reward' : 'เลือกรางวัล')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
