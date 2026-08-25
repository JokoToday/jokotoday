import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Gift, Loader2, Pencil, Plus, Save, Star, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type PurchaseType = 'online' | 'pickup' | 'walk_in';
type RewardType = 'fixed_discount' | 'percentage_discount' | 'free_product' | 'free_item' | 'custom';
type RewardChannel = 'online' | 'pickup' | 'walk_in';

interface EarningRule {
  purchase_type: PurchaseType;
  points_percentage: number | string;
  points_per_baht: number | string;
  label_en?: string | null;
  label_th?: string | null;
}

interface RewardProduct {
  id: string;
  name_en: string;
  name_th: string;
  name_zh?: string | null;
}

interface LoyaltyReward {
  id: string;
  reward_key: string;
  name_en: string;
  name_th: string;
  name_zh: string;
  description_en: string | null;
  description_th: string | null;
  description_zh: string | null;
  reward_type: RewardType;
  points_required: number;
  fixed_discount_amount: number | string | null;
  percentage_discount: number | string | null;
  max_discount_amount: number | string | null;
  product_id: string | null;
  channels: RewardChannel[];
  minimum_order_amount: number | string;
  per_customer_limit: number | null;
  total_redemption_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  is_active: boolean;
}

interface RewardDraft {
  id: string | null;
  rewardKey: string;
  nameEn: string;
  nameTh: string;
  nameZh: string;
  descriptionEn: string;
  descriptionTh: string;
  descriptionZh: string;
  rewardType: RewardType;
  pointsRequired: string;
  fixedDiscountAmount: string;
  percentageDiscount: string;
  maxDiscountAmount: string;
  productId: string;
  channels: RewardChannel[];
  minimumOrderAmount: string;
  perCustomerLimit: string;
  totalRedemptionLimit: string;
  startsAt: string;
  endsAt: string;
  sortOrder: string;
  isActive: boolean;
}

const purchaseTypeLabels: Record<PurchaseType, string> = {
  online: 'Online / Pre-order',
  pickup: 'Pickup order',
  walk_in: 'Walk-in',
};

const rewardTypeLabels: Record<RewardType, string> = {
  fixed_discount: 'Fixed ฿ discount',
  percentage_discount: 'Percentage discount',
  free_product: 'Free product',
  free_item: 'Free goodie / item',
  custom: 'Custom reward',
};

const channelLabels: Record<RewardChannel, string> = {
  online: 'Online',
  pickup: 'Pickup desk',
  walk_in: 'Walk-in',
};

function emptyRewardDraft(): RewardDraft {
  return {
    id: null,
    rewardKey: '',
    nameEn: '',
    nameTh: '',
    nameZh: '',
    descriptionEn: '',
    descriptionTh: '',
    descriptionZh: '',
    rewardType: 'free_item',
    pointsRequired: '',
    fixedDiscountAmount: '',
    percentageDiscount: '',
    maxDiscountAmount: '',
    productId: '',
    channels: ['online', 'pickup', 'walk_in'],
    minimumOrderAmount: '0',
    perCustomerLimit: '',
    totalRedemptionLimit: '',
    startsAt: '',
    endsAt: '',
    sortOrder: '0',
    isActive: true,
  };
}

function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rewardToDraft(reward: LoyaltyReward): RewardDraft {
  return {
    id: reward.id,
    rewardKey: reward.reward_key,
    nameEn: reward.name_en,
    nameTh: reward.name_th,
    nameZh: reward.name_zh,
    descriptionEn: reward.description_en || '',
    descriptionTh: reward.description_th || '',
    descriptionZh: reward.description_zh || '',
    rewardType: reward.reward_type,
    pointsRequired: String(reward.points_required),
    fixedDiscountAmount: reward.fixed_discount_amount == null ? '' : String(reward.fixed_discount_amount),
    percentageDiscount: reward.percentage_discount == null ? '' : String(reward.percentage_discount),
    maxDiscountAmount: reward.max_discount_amount == null ? '' : String(reward.max_discount_amount),
    productId: reward.product_id || '',
    channels: reward.channels || [],
    minimumOrderAmount: String(reward.minimum_order_amount || 0),
    perCustomerLimit: reward.per_customer_limit == null ? '' : String(reward.per_customer_limit),
    totalRedemptionLimit: reward.total_redemption_limit == null ? '' : String(reward.total_redemption_limit),
    startsAt: toLocalDateTime(reward.starts_at),
    endsAt: toLocalDateTime(reward.ends_at),
    sortOrder: String(reward.sort_order || 0),
    isActive: reward.is_active,
  };
}

export function LoyaltyRewardsManagement() {
  const [earningRules, setEarningRules] = useState<EarningRule[]>([]);
  const [earningDrafts, setEarningDrafts] = useState<Record<PurchaseType, string>>({ online: '', pickup: '', walk_in: '' });
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [products, setProducts] = useState<RewardProduct[]>([]);
  const [rewardDraft, setRewardDraft] = useState<RewardDraft>(emptyRewardDraft());
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRule, setSavingRule] = useState<PurchaseType | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [migrationPending, setMigrationPending] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    setMigrationPending(false);

    try {
      const [settingsResult, rewardsResult, productsResult] = await Promise.all([
        supabase
          .from('loyalty_settings')
          .select('purchase_type, points_percentage, points_per_baht, label_en, label_th')
          .in('purchase_type', ['online', 'pickup', 'walk_in']),
        supabase.rpc('admin_list_loyalty_rewards_v2'),
        supabase
          .from('cms_products')
          .select('id, name_en, name_th, name_zh')
          .eq('is_active', true)
          .order('name_en', { ascending: true }),
      ]);

      if (settingsResult.error) throw settingsResult.error;
      if (productsResult.error) throw productsResult.error;

      const settings = (settingsResult.data || []) as EarningRule[];
      setEarningRules(settings);
      setEarningDrafts((current) => {
        const next = { ...current };
        for (const rule of settings) {
          next[rule.purchase_type] = String(rule.points_percentage ?? 0);
        }
        return next;
      });
      setProducts((productsResult.data || []) as RewardProduct[]);

      if (rewardsResult.error) {
        const message = rewardsResult.error.message || '';
        if (message.includes('admin_list_loyalty_rewards_v2') || message.includes('Could not find the function')) {
          setMigrationPending(true);
          setRewards([]);
        } else {
          throw rewardsResult.error;
        }
      } else {
        setRewards((rewardsResult.data || []) as LoyaltyReward[]);
      }
    } catch (loadError) {
      console.error('Failed to load Loyalty & Rewards Admin:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load loyalty configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const productNames = useMemo(() => new Map(products.map((product) => [product.id, product.name_en])), [products]);

  const saveEarningRule = async (purchaseType: PurchaseType) => {
    const percentage = Number(earningDrafts[purchaseType]);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      setError('Earning percentage must be between 0 and 100.');
      return;
    }

    if (!confirm(`Change ${purchaseTypeLabels[purchaseType]} earning rate to ${percentage}%?`)) return;

    setSavingRule(purchaseType);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('admin_update_loyalty_earning_rule_v2', {
        p_purchase_type: purchaseType,
        p_points_percentage: percentage,
      });
      if (rpcError) throw rpcError;
      setNotice(`${purchaseTypeLabels[purchaseType]} earning rate saved.`);
      await loadData();
    } catch (saveError) {
      console.error('Failed to save earning rule:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Failed to save earning rule.');
    } finally {
      setSavingRule(null);
    }
  };

  const beginNewReward = () => {
    setRewardDraft(emptyRewardDraft());
    setShowRewardForm(true);
    setError('');
    setNotice('');
  };

  const beginEditReward = (reward: LoyaltyReward) => {
    setRewardDraft(rewardToDraft(reward));
    setShowRewardForm(true);
    setError('');
    setNotice('');
  };

  const toggleChannel = (channel: RewardChannel) => {
    setRewardDraft((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));
  };

  const handleRewardTypeChange = (rewardType: RewardType) => {
    setRewardDraft((current) => ({
      ...current,
      rewardType,
      fixedDiscountAmount: rewardType === 'fixed_discount' ? current.fixedDiscountAmount : '',
      percentageDiscount: rewardType === 'percentage_discount' ? current.percentageDiscount : '',
      maxDiscountAmount: rewardType === 'percentage_discount' ? current.maxDiscountAmount : '',
      productId: rewardType === 'free_product' ? current.productId : '',
    }));
  };

  const saveReward = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const pointsRequired = Number(rewardDraft.pointsRequired);
    if (!rewardDraft.rewardKey.trim() || !rewardDraft.nameEn.trim() || !rewardDraft.nameTh.trim() || !rewardDraft.nameZh.trim()) {
      setError('Reward key and EN / TH / ZH names are required.');
      return;
    }
    if (!Number.isInteger(pointsRequired) || pointsRequired <= 0) {
      setError('Points required must be a positive whole number.');
      return;
    }
    if (rewardDraft.channels.length === 0) {
      setError('Select at least one redemption channel.');
      return;
    }
    if (rewardDraft.rewardType === 'fixed_discount' && !(Number(rewardDraft.fixedDiscountAmount) > 0)) {
      setError('Enter a positive THB amount for the fixed discount.');
      return;
    }
    if (
      rewardDraft.rewardType === 'percentage_discount'
      && (!(Number(rewardDraft.percentageDiscount) > 0) || Number(rewardDraft.percentageDiscount) > 100)
    ) {
      setError('Percentage discount must be greater than 0 and no more than 100.');
      return;
    }
    if (rewardDraft.rewardType === 'free_product' && !rewardDraft.productId) {
      setError('Choose the real product linked to this free-product reward.');
      return;
    }

    const action = rewardDraft.id ? 'Update' : 'Create';
    if (!confirm(`${action} reward “${rewardDraft.nameEn.trim()}” for ${pointsRequired} points?`)) return;

    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc('admin_upsert_loyalty_reward_v2', {
        p_reward_id: rewardDraft.id,
        p_reward_key: rewardDraft.rewardKey.trim().toLowerCase(),
        p_name_en: rewardDraft.nameEn.trim(),
        p_name_th: rewardDraft.nameTh.trim(),
        p_name_zh: rewardDraft.nameZh.trim(),
        p_description_en: rewardDraft.descriptionEn.trim() || null,
        p_description_th: rewardDraft.descriptionTh.trim() || null,
        p_description_zh: rewardDraft.descriptionZh.trim() || null,
        p_reward_type: rewardDraft.rewardType,
        p_points_required: pointsRequired,
        p_fixed_discount_amount: rewardDraft.rewardType === 'fixed_discount' ? Number(rewardDraft.fixedDiscountAmount) : null,
        p_percentage_discount: rewardDraft.rewardType === 'percentage_discount' ? Number(rewardDraft.percentageDiscount) : null,
        p_max_discount_amount: rewardDraft.rewardType === 'percentage_discount' ? optionalNumber(rewardDraft.maxDiscountAmount) : null,
        p_product_id: rewardDraft.rewardType === 'free_product' ? rewardDraft.productId : null,
        p_channels: rewardDraft.channels,
        p_minimum_order_amount: Number(rewardDraft.minimumOrderAmount || 0),
        p_per_customer_limit: optionalNumber(rewardDraft.perCustomerLimit),
        p_total_redemption_limit: optionalNumber(rewardDraft.totalRedemptionLimit),
        p_starts_at: rewardDraft.startsAt ? new Date(rewardDraft.startsAt).toISOString() : null,
        p_ends_at: rewardDraft.endsAt ? new Date(rewardDraft.endsAt).toISOString() : null,
        p_sort_order: Number(rewardDraft.sortOrder || 0),
        p_is_active: rewardDraft.isActive,
      });

      if (rpcError) throw rpcError;
      setNotice(`Reward ${rewardDraft.id ? 'updated' : 'created'}.`);
      setRewardDraft(emptyRewardDraft());
      setShowRewardForm(false);
      await loadData();
    } catch (saveError) {
      console.error('Failed to save reward:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Failed to save reward.');
    } finally {
      setSaving(false);
    }
  };

  const setRewardActive = async (reward: LoyaltyReward, isActive: boolean) => {
    if (!confirm(`${isActive ? 'Activate' : 'Deactivate'} reward “${reward.name_en}”?`)) return;
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('admin_set_loyalty_reward_active_v2', {
        p_reward_id: reward.id,
        p_is_active: isActive,
      });
      if (rpcError) throw rpcError;
      setNotice(`Reward ${isActive ? 'activated' : 'deactivated'}.`);
      await loadData();
    } catch (toggleError) {
      console.error('Failed to change reward status:', toggleError);
      setError(toggleError instanceof Error ? toggleError.message : 'Failed to change reward status.');
    }
  };

  const describeReward = (reward: LoyaltyReward) => {
    if (reward.reward_type === 'fixed_discount') return `฿${Number(reward.fixed_discount_amount || 0).toFixed(2)} off`;
    if (reward.reward_type === 'percentage_discount') {
      const max = reward.max_discount_amount == null ? '' : ` (max ฿${Number(reward.max_discount_amount).toFixed(2)})`;
      return `${Number(reward.percentage_discount || 0)}% off${max}`;
    }
    if (reward.reward_type === 'free_product') return `Free ${productNames.get(reward.product_id || '') || 'linked product'}`;
    return rewardTypeLabels[reward.reward_type];
  };

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center gap-3 text-gray-600">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading loyalty configuration…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-950">
          <p className="font-semibold">Reward configuration is separate from customer redemption.</p>
          <p className="mt-1">Points have no fixed cash value. You decide what each reward costs and what it gives. Customer redemption remains disabled until the checkout / staff fulfillment flow is separately approved and enabled.</p>
        </div>
      </div>

      {migrationPending && (
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
          Loyalty v2 database migration has not been applied to this environment yet. The earning settings below are read-only until the reviewed migration is approved; reward catalogue data will appear after that migration exists.
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Star className="w-5 h-5" /> Earning Rules</h2>
            <p className="text-sm text-gray-600 mt-1">Set how many points customers earn from each purchase channel. These rates do not determine what points can be redeemed for.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {(['online', 'pickup', 'walk_in'] as PurchaseType[]).map((purchaseType) => {
            const current = earningRules.find((rule) => rule.purchase_type === purchaseType);
            return (
              <div key={purchaseType} className="rounded-xl border border-gray-200 p-4">
                <p className="font-semibold text-gray-900">{purchaseTypeLabels[purchaseType]}</p>
                <p className="text-xs text-gray-500 mt-1">Current: {Number(current?.points_percentage ?? 0)}%</p>
                <label className="block mt-4">
                  <span className="text-xs font-medium text-gray-600">Points earned (% of spend)</span>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={earningDrafts[purchaseType]}
                      onChange={(event) => setEarningDrafts((drafts) => ({ ...drafts, [purchaseType]: event.target.value }))}
                      disabled={migrationPending || savingRule !== null}
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => void saveEarningRule(purchaseType)}
                      disabled={migrationPending || savingRule !== null}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white disabled:bg-gray-300"
                    >
                      {savingRule === purchaseType ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </button>
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Gift className="w-5 h-5" /> Reward Catalogue</h2>
            <p className="text-sm text-gray-600 mt-1">Examples: 100 pts → ฿50 off, 120 pts → free croissant, or 250 pts → birthday surprise.</p>
          </div>
          <button
            type="button"
            onClick={beginNewReward}
            disabled={migrationPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-300"
          >
            <Plus className="w-4 h-4" /> Add Reward
          </button>
        </div>

        {showRewardForm && (
          <form onSubmit={saveReward} className="mb-6 rounded-xl border border-primary-200 bg-primary-50/30 p-5 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">{rewardDraft.id ? 'Edit Reward' : 'New Reward'}</h3>
              <button type="button" onClick={() => setShowRewardForm(false)} className="text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Reward key" help="Stable technical key; cannot be changed later.">
                <input
                  value={rewardDraft.rewardKey}
                  onChange={(event) => setRewardDraft((draft) => ({ ...draft, rewardKey: event.target.value.replace(/\s+/g, '-').toLowerCase() }))}
                  disabled={Boolean(rewardDraft.id)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
                  placeholder="free-croissant"
                />
              </Field>
              <Field label="Points required">
                <input type="number" min="1" step="1" value={rewardDraft.pointsRequired} onChange={(event) => setRewardDraft((draft) => ({ ...draft, pointsRequired: event.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2" />
              </Field>
              <Field label="Name — English"><input value={rewardDraft.nameEn} onChange={(event) => setRewardDraft((draft) => ({ ...draft, nameEn: event.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2" /></Field>
              <Field label="Name — ไทย"><input value={rewardDraft.nameTh} onChange={(event) => setRewardDraft((draft) => ({ ...draft, nameTh: event.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2" /></Field>
              <Field label="Name — 中文"><input value={rewardDraft.nameZh} onChange={(event) => setRewardDraft((draft) => ({ ...draft, nameZh: event.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2" /></Field>
              <Field label="Reward type">
                <select value={rewardDraft.rewardType} onChange={(event) => handleRewardTypeChange(event.target.value as RewardType)} className="w-full rounded-lg border border-gray-300 px-3 py-2">
                  {(Object.keys(rewardTypeLabels) as RewardType[]).map((type) => <option key={type} value={type}>{rewardTypeLabels[type]}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Description — English"><textarea value={rewardDraft.descriptionEn} onChange={(event) => setRewardDraft((draft) => ({ ...draft, descriptionEn: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" rows={3} /></Field>
              <Field label="Description — ไทย"><textarea value={rewardDraft.descriptionTh} onChange={(event) => setRewardDraft((draft) => ({ ...draft, descriptionTh: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" rows={3} /></Field>
              <Field label="Description — 中文"><textarea value={rewardDraft.descriptionZh} onChange={(event) => setRewardDraft((draft) => ({ ...draft, descriptionZh: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" rows={3} /></Field>
            </div>

            {rewardDraft.rewardType === 'fixed_discount' && (
              <Field label="Discount amount (THB)" help="This amount is a property of this reward, not a universal point conversion.">
                <input type="number" min="0.01" step="0.01" value={rewardDraft.fixedDiscountAmount} onChange={(event) => setRewardDraft((draft) => ({ ...draft, fixedDiscountAmount: event.target.value }))} className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2" required />
              </Field>
            )}

            {rewardDraft.rewardType === 'percentage_discount' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Discount percentage"><input type="number" min="0.01" max="100" step="0.01" value={rewardDraft.percentageDiscount} onChange={(event) => setRewardDraft((draft) => ({ ...draft, percentageDiscount: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" required /></Field>
                <Field label="Maximum discount (THB)" help="Optional"><input type="number" min="0.01" step="0.01" value={rewardDraft.maxDiscountAmount} onChange={(event) => setRewardDraft((draft) => ({ ...draft, maxDiscountAmount: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></Field>
              </div>
            )}

            {rewardDraft.rewardType === 'free_product' && (
              <Field label="Free product" help="Linked to a real CMS product; it is not converted to a cash discount.">
                <select value={rewardDraft.productId} onChange={(event) => setRewardDraft((draft) => ({ ...draft, productId: event.target.value }))} required className="w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2">
                  <option value="">Choose product…</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name_en} / {product.name_th}</option>)}
                </select>
              </Field>
            )}

            <Field label="Redemption channels">
              <div className="flex flex-wrap gap-3">
                {(Object.keys(channelLabels) as RewardChannel[]).map((channel) => (
                  <label key={channel} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                    <input type="checkbox" checked={rewardDraft.channels.includes(channel)} onChange={() => toggleChannel(channel)} /> {channelLabels[channel]}
                  </label>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Minimum order (THB)"><input type="number" min="0" step="0.01" value={rewardDraft.minimumOrderAmount} onChange={(event) => setRewardDraft((draft) => ({ ...draft, minimumOrderAmount: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></Field>
              <Field label="Limit per customer" help="Optional"><input type="number" min="1" step="1" value={rewardDraft.perCustomerLimit} onChange={(event) => setRewardDraft((draft) => ({ ...draft, perCustomerLimit: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></Field>
              <Field label="Total reward limit" help="Optional"><input type="number" min="1" step="1" value={rewardDraft.totalRedemptionLimit} onChange={(event) => setRewardDraft((draft) => ({ ...draft, totalRedemptionLimit: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></Field>
              <Field label="Valid from" help="Optional"><input type="datetime-local" value={rewardDraft.startsAt} onChange={(event) => setRewardDraft((draft) => ({ ...draft, startsAt: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></Field>
              <Field label="Valid until" help="Optional"><input type="datetime-local" value={rewardDraft.endsAt} onChange={(event) => setRewardDraft((draft) => ({ ...draft, endsAt: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></Field>
              <Field label="Sort order"><input type="number" step="1" value={rewardDraft.sortOrder} onChange={(event) => setRewardDraft((draft) => ({ ...draft, sortOrder: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></Field>
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={rewardDraft.isActive} onChange={(event) => setRewardDraft((draft) => ({ ...draft, isActive: event.target.checked }))} /> Active reward
            </label>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowRewardForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-300">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Reward
              </button>
            </div>
          </form>
        )}

        {rewards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">
            {migrationPending ? 'Reward catalogue becomes available after the Loyalty v2 migration is approved and applied.' : 'No rewards configured yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <th className="px-3 py-3">Reward</th>
                  <th className="px-3 py-3">Cost</th>
                  <th className="px-3 py-3">Gives</th>
                  <th className="px-3 py-3">Channels</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((reward) => (
                  <tr key={reward.id} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-4">
                      <p className="font-semibold text-gray-900">{reward.name_en}</p>
                      <p className="text-xs text-gray-500">{reward.reward_key}</p>
                    </td>
                    <td className="px-3 py-4 font-semibold text-amber-700">{reward.points_required.toLocaleString()} pts</td>
                    <td className="px-3 py-4 text-gray-700">{describeReward(reward)}</td>
                    <td className="px-3 py-4 text-xs text-gray-600">{reward.channels.map((channel) => channelLabels[channel]).join(', ')}</td>
                    <td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${reward.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{reward.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-3 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => beginEditReward(reward)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                        <button type="button" onClick={() => void setRewardActive(reward, !reward.is_active)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700">{reward.is_active ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {help && <span className="block text-xs text-gray-500 mt-0.5">{help}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
