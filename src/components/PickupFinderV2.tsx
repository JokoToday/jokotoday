import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import {
  CommonPickupDateAvailability,
  getCommonPickupDates,
  getCustomerPickupAvailabilityV2,
} from '../lib/pickupAvailabilityV2';
import { getPickupV2CustomerEnabled } from '../lib/pickupV2Rollout';
import {
  clearPreferredPickupDateV2,
  readPreferredPickupDateV2,
  writePreferredPickupDateV2,
} from '../lib/pickupV2PreferredSelection';

export interface PickupFinderStateV2 {
  enabled: boolean;
  loading: boolean;
  hasCommonDates: boolean | null;
  selectedPickupDateId: string | null;
}

interface PickupFinderV2Props {
  onStateChange?: (state: PickupFinderStateV2) => void;
}

function formatPickupDate(value: string, language: 'en' | 'th' | 'zh'): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function PickupFinderV2({ onStateChange }: PickupFinderV2Props) {
  const { items } = useCart();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [enabled, setEnabled] = useState(false);
  const [rolloutResolved, setRolloutResolved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [commonDates, setCommonDates] = useState<CommonPickupDateAvailability[]>([]);
  const [selectedPickupDateId, setSelectedPickupDateId] = useState<string | null>(null);

  const requirements = useMemo(
    () => items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
    [items],
  );
  const requirementsKey = requirements
    .map(({ productId, quantity }) => `${productId}:${quantity}`)
    .sort()
    .join('|');

  useEffect(() => {
    let cancelled = false;
    void getPickupV2CustomerEnabled().then((value) => {
      if (!cancelled) {
        setEnabled(value);
        setRolloutResolved(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCommonDates = async () => {
    if (!enabled || requirements.length === 0) {
      setCommonDates([]);
      setSelectedPickupDateId(null);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const productIds = Array.from(new Set(requirements.map(({ productId }) => productId)));
      const rows = await getCustomerPickupAvailabilityV2(productIds);
      const nextCommonDates = getCommonPickupDates(rows, requirements);
      setCommonDates(nextCommonDates);

      const preferred = readPreferredPickupDateV2(user?.id ?? null);
      if (preferred && nextCommonDates.some((date) => date.pickupDateId === preferred.pickupDateId)) {
        setSelectedPickupDateId(preferred.pickupDateId);
      } else {
        if (preferred) clearPreferredPickupDateV2(user?.id ?? null);
        setSelectedPickupDateId(null);
      }
    } catch (err) {
      setCommonDates([]);
      setSelectedPickupDateId(null);
      setError(err instanceof Error ? err.message : 'Could not find a common pickup date.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!rolloutResolved) return;
    void loadCommonDates();
  }, [rolloutResolved, enabled, requirementsKey, user?.id]);

  useEffect(() => {
    onStateChange?.({
      enabled,
      loading: !rolloutResolved || (enabled && loading),
      hasCommonDates: enabled && rolloutResolved && !loading && !error
        ? commonDates.length > 0
        : null,
      selectedPickupDateId,
    });
  }, [enabled, rolloutResolved, loading, error, commonDates.length, selectedPickupDateId, onStateChange]);

  if (!rolloutResolved || !enabled || items.length === 0) return null;

  const title = language === 'th'
    ? 'ค้นหาวันรับสินค้าร่วมกัน'
    : language === 'zh'
      ? '取货日期查找器'
      : 'Pickup Finder';
  const helper = language === 'th'
    ? 'เราจะหาวันที่สินค้าทุกชิ้นในตะกร้ามีจำนวนเพียงพอและรับพร้อมกันได้'
    : language === 'zh'
      ? '我们会查找购物篮中所有商品库存都足够、可以一起取货的日期。'
      : 'Find dates when every item in your basket has enough stock to be picked up together.';
  const noMatch = language === 'th'
    ? 'ขณะนี้ไม่มีวันเดียวที่มีสินค้าทุกชิ้นในจำนวนที่คุณเลือก ลองลดจำนวนหรือนำบางรายการออก'
    : language === 'zh'
      ? '目前没有一个取货日期能满足购物篮中所有商品及其数量。请减少数量或移除部分商品。'
      : 'There is currently no single pickup date with enough stock for every item in this basket. Reduce quantities or remove an item.';

  const selectDate = (date: CommonPickupDateAvailability) => {
    setSelectedPickupDateId(date.pickupDateId);
    writePreferredPickupDateV2(user?.id ?? null, {
      pickupDateId: date.pickupDateId,
      pickupDate: date.pickupDate,
      scheduleId: date.scheduleId,
      scheduleKey: date.scheduleKey,
      scheduleLabelEn: date.scheduleLabelEn,
      scheduleLabelTh: date.scheduleLabelTh,
      scheduleLabelZh: date.scheduleLabelZh,
    });
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <CalendarDays className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{helper}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadCommonDates()}
          disabled={loading}
          className="p-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40 shrink-0"
          aria-label="Refresh Pickup Finder"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-lg bg-white/80 p-3 text-xs text-gray-500 text-center">
          {language === 'th' ? 'กำลังค้นหาวันที่รับพร้อมกัน…' : language === 'zh' ? '正在查找共同取货日期…' : 'Finding common pickup dates…'}
        </div>
      ) : commonDates.length === 0 ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 flex items-start gap-2 text-xs text-orange-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{noMatch}</span>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            {language === 'th'
              ? `พบ ${commonDates.length} วันที่รับสินค้าทุกชิ้นพร้อมกันได้`
              : language === 'zh'
                ? `找到 ${commonDates.length} 个可一起取货的日期`
                : `${commonDates.length} common pickup ${commonDates.length === 1 ? 'date' : 'dates'} found`}
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {commonDates.map((date) => {
              const selected = selectedPickupDateId === date.pickupDateId;
              const scheduleLabel = language === 'th'
                ? date.scheduleLabelTh || date.scheduleLabelEn
                : language === 'zh'
                  ? date.scheduleLabelZh || date.scheduleLabelEn
                  : date.scheduleLabelEn;
              const locationLabel = date.locations.length === 1
                ? (language === 'th'
                  ? date.locations[0].name_th || date.locations[0].name_en
                  : language === 'zh'
                    ? date.locations[0].name_zh || date.locations[0].name_en
                    : date.locations[0].name_en)
                : null;

              return (
                <button
                  key={date.pickupDateId}
                  type="button"
                  onClick={() => selectDate(date)}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    selected
                      ? 'border-amber-500 bg-amber-100'
                      : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{formatPickupDate(date.pickupDate, language)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {scheduleLabel}{locationLabel ? ` · ${locationLabel}` : ''}
                      </p>
                    </div>
                    {selected && (
                      <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-gray-500">
            {selectedPickupDateId
              ? (language === 'th' ? 'วันที่เลือกจะถูกนำไปยืนยันในหน้าชำระเงิน' : language === 'zh' ? '所选日期将在结账时自动带入并再次确认。' : 'Your selected date will be carried into checkout and revalidated there.')
              : (language === 'th' ? 'เลือกวันที่ตอนนี้ หรือเลือกภายหลังในหน้าชำระเงินก็ได้' : language === 'zh' ? '您可以现在选择日期，也可以在结账时再选择。' : 'Choose a date now, or choose one at checkout.')}
          </p>
        </>
      )}
    </div>
  );
}
