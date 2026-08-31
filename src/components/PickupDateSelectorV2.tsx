import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  CartAvailabilityRequirement,
  CommonPickupDateAvailability,
  getCommonPickupDates,
  getCustomerPickupAvailabilityV2,
} from '../lib/pickupAvailabilityV2';

export interface PickupSelectionV2 {
  pickupDateId: string;
  pickupDate: string;
  pickupLocationId: string;
  scheduleId: string;
  scheduleKey: string;
}

interface PickupDateSelectorV2Props {
  requirements: CartAvailabilityRequirement[];
  value: PickupSelectionV2 | null;
  onChange: (selection: PickupSelectionV2 | null) => void;
}

function utcDateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

function dateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function monthFromIndex(index: number): Date {
  return new Date(Date.UTC(Math.floor(index / 12), index % 12, 1, 12));
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
}

export function PickupDateSelectorV2({
  requirements,
  value,
  onChange,
}: PickupDateSelectorV2Props) {
  const { language } = useLanguage();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getCustomerPickupAvailabilityV2>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeDateId, setActiveDateId] = useState<string | null>(value?.pickupDateId || null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => monthStart(new Date()));

  const productIds = useMemo(
    () => Array.from(new Set(requirements.map(({ productId }) => productId).filter(Boolean))).sort(),
    [requirements],
  );
  const productIdsKey = productIds.join(',');

  const commonDates = useMemo(
    () => getCommonPickupDates(rows, requirements),
    [rows, requirements],
  );

  const commonDateById = useMemo(() => {
    const map = new Map<string, CommonPickupDateAvailability>();
    commonDates.forEach((date) => map.set(date.pickupDateId, date));
    return map;
  }, [commonDates]);

  const datesForCalendar = useMemo(() => {
    const byId = new Map<string, { id: string; pickupDate: string }>();
    rows.forEach((row) => {
      if (!byId.has(row.pickup_date_id)) {
        byId.set(row.pickup_date_id, {
          id: row.pickup_date_id,
          pickupDate: row.pickup_date,
        });
      }
    });
    return Array.from(byId.values()).sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
  }, [rows]);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      if (productIds.length === 0) {
        setRows([]);
        setLoading(false);
        setError('');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const nextRows = await getCustomerPickupAvailabilityV2(productIds);
        if (!cancelled) setRows(nextRows);
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setError(err instanceof Error ? err.message : 'Could not load pickup availability.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [productIdsKey]);

  useEffect(() => {
    if (value) {
      const selectedDate = commonDateById.get(value.pickupDateId);
      const locationStillActive = selectedDate?.locations.some((location) => location.id === value.pickupLocationId);
      if (!selectedDate || !locationStillActive) {
        onChange(null);
        setActiveDateId(null);
        return;
      }
      setActiveDateId(value.pickupDateId);
      setVisibleMonth(monthStart(utcDateFromKey(value.pickupDate)));
      return;
    }

    if (commonDates.length > 0 && activeDateId === null) {
      setVisibleMonth(monthStart(utcDateFromKey(commonDates[0].pickupDate)));
    }
  }, [value?.pickupDateId, value?.pickupLocationId, commonDates, commonDateById]);

  const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
  const activeDate = activeDateId ? commonDateById.get(activeDateId) || null : null;

  const calendarMonthIndices = datesForCalendar.map(({ pickupDate }) => monthIndex(utcDateFromKey(pickupDate)));
  const currentMonthIndex = monthIndex(visibleMonth);
  const minMonthIndex = calendarMonthIndices.length > 0
    ? Math.min(...calendarMonthIndices)
    : currentMonthIndex;
  const maxMonthIndex = calendarMonthIndices.length > 0
    ? Math.max(...calendarMonthIndices)
    : currentMonthIndex;

  const dateIdByKey = useMemo(
    () => new Map(datesForCalendar.map((date) => [date.pickupDate, date.id])),
    [datesForCalendar],
  );

  const firstWeekday = new Date(Date.UTC(
    visibleMonth.getUTCFullYear(),
    visibleMonth.getUTCMonth(),
    1,
    12,
  )).getUTCDay();
  const daysInMonth = new Date(Date.UTC(
    visibleMonth.getUTCFullYear(),
    visibleMonth.getUTCMonth() + 1,
    0,
    12,
  )).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const calendarCells = Array.from({ length: cellCount }, (_, index) => {
    const dayNumber = index - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) return null;
    return new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), dayNumber, 12));
  });

  const weekdayLabels = Array.from({ length: 7 }, (_, weekday) => {
    const date = new Date(Date.UTC(2026, 7, 23 + weekday, 12));
    return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date);
  });

  const handleDateSelection = (date: CommonPickupDateAvailability) => {
    setActiveDateId(date.pickupDateId);
    if (date.locations.length === 1) {
      onChange({
        pickupDateId: date.pickupDateId,
        pickupDate: date.pickupDate,
        pickupLocationId: date.locations[0].id,
        scheduleId: date.scheduleId,
        scheduleKey: date.scheduleKey,
      });
      return;
    }

    if (value?.pickupDateId !== date.pickupDateId) {
      onChange(null);
    }
  };

  const selectLocation = (date: CommonPickupDateAvailability, locationId: string) => {
    onChange({
      pickupDateId: date.pickupDateId,
      pickupDate: date.pickupDate,
      pickupLocationId: locationId,
      scheduleId: date.scheduleId,
      scheduleKey: date.scheduleKey,
    });
  };

  const title = language === 'th'
    ? 'เลือกวันที่รับสินค้า'
    : language === 'zh'
      ? '选择取货日期'
      : 'Choose your pickup date';
  const helper = language === 'th'
    ? 'แสดงเฉพาะวันที่ที่สินค้าทั้งหมดในตะกร้ามีจำนวนเพียงพอ'
    : language === 'zh'
      ? '仅显示购物车内所有商品都有足够库存的日期。'
      : 'Only dates where every item in your cart has enough availability can be selected.';

  return (
    <div className="max-w-3xl mx-auto mb-8">
      <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-5 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600 mt-1">{helper}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setRows([]);
              setLoading(true);
              getCustomerPickupAvailabilityV2(productIds)
                .then(setRows)
                .catch((err) => setError(err instanceof Error ? err.message : 'Could not refresh pickup availability.'))
                .finally(() => setLoading(false));
            }}
            disabled={loading || productIds.length === 0}
            className="p-2 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
            aria-label="Refresh pickup availability"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white/70 rounded-xl py-12 text-center text-sm text-gray-500">
            {language === 'th' ? 'กำลังโหลดวันรับสินค้า…' : language === 'zh' ? '正在加载取货日期…' : 'Loading pickup dates…'}
          </div>
        ) : productIds.length === 0 ? (
          <div className="bg-white/70 rounded-xl py-10 text-center text-sm text-gray-500">
            {language === 'th' ? 'เพิ่มสินค้าในตะกร้าก่อนเลือกวันรับสินค้า' : language === 'zh' ? '请先将商品加入购物车。' : 'Add products to your cart before choosing a pickup date.'}
          </div>
        ) : datesForCalendar.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-white px-4 py-5 text-sm text-gray-600">
            {language === 'th' ? 'ยังไม่มีวันรับสินค้าที่เปิดให้สั่ง' : language === 'zh' ? '目前没有可订购的取货日期。' : 'No orderable pickup dates are currently available.'}
          </div>
        ) : (
          <>
            <div className="bg-white border border-amber-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100">
                <button
                  type="button"
                  onClick={() => setVisibleMonth(monthFromIndex(currentMonthIndex - 1))}
                  disabled={currentMonthIndex <= minMonthIndex}
                  className="p-2 rounded-lg text-gray-600 hover:bg-amber-50 disabled:opacity-25"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <p className="font-semibold text-gray-900 capitalize">
                  {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(visibleMonth)}
                </p>
                <button
                  type="button"
                  onClick={() => setVisibleMonth(monthFromIndex(currentMonthIndex + 1))}
                  disabled={currentMonthIndex >= maxMonthIndex}
                  className="p-2 rounded-lg text-gray-600 hover:bg-amber-50 disabled:opacity-25"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 px-2 pt-3">
                {weekdayLabels.map((label, index) => (
                  <div key={`${label}-${index}`} className="text-center text-[11px] sm:text-xs font-semibold text-gray-400 py-1">
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 p-2 sm:p-3 pt-1">
                {calendarCells.map((date, index) => {
                  if (!date) return <div key={`blank-${index}`} className="aspect-square" />;

                  const key = dateKey(date);
                  const pickupDateId = dateIdByKey.get(key);
                  const selectableDate = pickupDateId ? commonDateById.get(pickupDateId) || null : null;
                  const hasMaterializedProductDate = Boolean(pickupDateId);
                  const isSelected = Boolean(selectableDate && activeDateId === selectableDate.pickupDateId);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectableDate && handleDateSelection(selectableDate)}
                      disabled={!selectableDate}
                      className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-amber-600 border-amber-600 text-white shadow-md'
                          : selectableDate
                            ? 'bg-amber-50 border-amber-200 text-gray-900 hover:bg-amber-100 hover:border-amber-400'
                            : hasMaterializedProductDate
                              ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-white border-transparent text-gray-300 cursor-default'
                      }`}
                    >
                      <span className="text-sm sm:text-base font-semibold">{date.getUTCDate()}</span>
                      {hasMaterializedProductDate && (
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : selectableDate ? 'bg-green-500' : 'bg-gray-300'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {commonDates.length === 0 && (
              <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm text-orange-800">
                {language === 'th'
                  ? 'ไม่มีวันที่ที่สินค้าทั้งหมดในตะกร้ามีจำนวนเพียงพอ ลองปรับสินค้า หรือจำนวนสินค้า'
                  : language === 'zh'
                    ? '目前没有一个日期能同时满足购物车内所有商品的数量。请调整商品或数量。'
                    : 'There is currently no single date with enough availability for every item in your cart. Adjust the cart or quantities and try again.'}
              </div>
            )}

            {activeDate && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {new Intl.DateTimeFormat(locale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'UTC',
                      }).format(utcDateFromKey(activeDate.pickupDate))}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {language === 'th'
                        ? activeDate.scheduleLabelTh || activeDate.scheduleLabelEn
                        : language === 'zh'
                          ? activeDate.scheduleLabelZh || activeDate.scheduleLabelEn
                          : activeDate.scheduleLabelEn}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-4 h-4" />
                    {language === 'th' ? 'สั่งได้ถึง' : language === 'zh' ? '下单截止' : 'Order cutoff'}{' '}
                    {new Intl.DateTimeFormat(locale, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Bangkok',
                    }).format(new Date(activeDate.orderCutoffAt))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-700" />
                    {language === 'th' ? 'จุดรับสินค้า' : language === 'zh' ? '取货地点' : 'Pickup location'}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activeDate.locations.map((location) => {
                      const isLocationSelected = value?.pickupDateId === activeDate.pickupDateId
                        && value.pickupLocationId === location.id;
                      const name = language === 'th'
                        ? location.name_th || location.name_en
                        : language === 'zh'
                          ? location.name_zh || location.name_en
                          : location.name_en;
                      const description = language === 'th'
                        ? location.description_th || location.description_en
                        : language === 'zh'
                          ? location.description_zh || location.description_en
                          : location.description_en;

                      return (
                        <button
                          key={location.id}
                          type="button"
                          onClick={() => selectLocation(activeDate, location.id)}
                          className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                            isLocationSelected
                              ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-300'
                              : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50'
                          }`}
                        >
                          <p className="font-medium text-gray-900">{name}</p>
                          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
