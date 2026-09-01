import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  getCustomerPickupAvailabilityV2,
  PickupAvailabilityRow,
} from '../lib/pickupAvailabilityV2';

export interface PickupBrowseSelectionV2 {
  pickupDateId: string;
  pickupDate: string;
  scheduleId: string;
  scheduleKey: string;
  scheduleLabelEn: string;
  scheduleLabelTh: string | null;
  scheduleLabelZh: string | null;
}

interface PickupBrowseDateSelectorV2Props {
  productIds: string[];
  value: PickupBrowseSelectionV2 | null;
  onChange: (selection: PickupBrowseSelectionV2 | null) => void;
  onAvailabilityRowsChange?: (rows: PickupAvailabilityRow[]) => void;
}

interface BrowseDate {
  pickupDateId: string;
  pickupDate: string;
  scheduleId: string;
  scheduleKey: string;
  scheduleLabelEn: string;
  scheduleLabelTh: string | null;
  scheduleLabelZh: string | null;
  availableProductCount: number;
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

export function PickupBrowseDateSelectorV2({
  productIds,
  value,
  onChange,
  onAvailabilityRowsChange,
}: PickupBrowseDateSelectorV2Props) {
  const { language } = useLanguage();
  const [rows, setRows] = useState<PickupAvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => monthStart(new Date()));

  const uniqueProductIds = useMemo(
    () => Array.from(new Set(productIds.filter(Boolean))).sort(),
    [productIds],
  );
  const productIdsKey = uniqueProductIds.join(',');

  const browseDates = useMemo<BrowseDate[]>(() => {
    const byDate = new Map<string, PickupAvailabilityRow[]>();
    rows.forEach((row) => {
      const current = byDate.get(row.pickup_date_id) || [];
      current.push(row);
      byDate.set(row.pickup_date_id, current);
    });

    return Array.from(byDate.values())
      .flatMap((dateRows) => {
        const availableRows = dateRows.filter((row) => row.remaining_quantity > 0);
        if (availableRows.length === 0) return [];
        const representative = availableRows[0];
        return [{
          pickupDateId: representative.pickup_date_id,
          pickupDate: representative.pickup_date,
          scheduleId: representative.schedule_id,
          scheduleKey: representative.schedule_key,
          scheduleLabelEn: representative.schedule_label_en,
          scheduleLabelTh: representative.schedule_label_th,
          scheduleLabelZh: representative.schedule_label_zh,
          availableProductCount: new Set(availableRows.map((row) => row.product_id)).size,
        }];
      })
      .sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
  }, [rows]);

  const browseDateById = useMemo(
    () => new Map(browseDates.map((date) => [date.pickupDateId, date])),
    [browseDates],
  );
  const dateIdByKey = useMemo(
    () => new Map(browseDates.map((date) => [date.pickupDate, date.pickupDateId])),
    [browseDates],
  );

  const loadAvailability = async () => {
    if (uniqueProductIds.length === 0) {
      setRows([]);
      onAvailabilityRowsChange?.([]);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const nextRows = await getCustomerPickupAvailabilityV2(uniqueProductIds);
      setRows(nextRows);
      onAvailabilityRowsChange?.(nextRows);
    } catch (err) {
      setRows([]);
      onAvailabilityRowsChange?.([]);
      setError(err instanceof Error ? err.message : 'Could not load pickup availability.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAvailability();
  }, [productIdsKey]);

  useEffect(() => {
    if (value && !browseDateById.has(value.pickupDateId)) {
      onChange(null);
      return;
    }
    if (value) {
      setVisibleMonth(monthStart(utcDateFromKey(value.pickupDate)));
      return;
    }
    if (browseDates.length > 0) {
      setVisibleMonth(monthStart(utcDateFromKey(browseDates[0].pickupDate)));
    }
  }, [value?.pickupDateId, browseDates, browseDateById]);

  const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
  const calendarMonthIndices = browseDates.map(({ pickupDate }) => monthIndex(utcDateFromKey(pickupDate)));
  const currentMonthIndex = monthIndex(visibleMonth);
  const minMonthIndex = calendarMonthIndices.length > 0 ? Math.min(...calendarMonthIndices) : currentMonthIndex;
  const maxMonthIndex = calendarMonthIndices.length > 0 ? Math.max(...calendarMonthIndices) : currentMonthIndex;

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

  const title = language === 'th'
    ? 'เลือกวันที่รับสินค้า'
    : language === 'zh'
      ? '选择取货日期'
      : 'Choose your pickup date';
  const helper = language === 'th'
    ? 'เลือกวันที่เพื่อดูสินค้าที่มีจำหน่ายจริงตามสต็อก Pickup v2'
    : language === 'zh'
      ? '选择日期以查看 Pickup v2 实际库存中可订购的商品。'
      : 'Choose a date to see products that are actually available in Pickup v2 inventory.';

  const selectedDate = value ? browseDateById.get(value.pickupDateId) || null : null;
  const selectedScheduleLabel = selectedDate
    ? (language === 'th'
      ? selectedDate.scheduleLabelTh || selectedDate.scheduleLabelEn
      : language === 'zh'
        ? selectedDate.scheduleLabelZh || selectedDate.scheduleLabelEn
        : selectedDate.scheduleLabelEn)
    : null;

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
            onClick={() => void loadAvailability()}
            disabled={loading || uniqueProductIds.length === 0}
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
        ) : browseDates.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-white px-4 py-5 text-sm text-gray-600">
            {language === 'th' ? 'ยังไม่มีวันรับสินค้าที่มีสินค้าให้สั่ง' : language === 'zh' ? '目前没有可订购商品的取货日期。' : 'No pickup dates currently have orderable products.'}
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
                  const browseDate = pickupDateId ? browseDateById.get(pickupDateId) || null : null;
                  const isSelected = Boolean(browseDate && value?.pickupDateId === browseDate.pickupDateId);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => browseDate && onChange({
                        pickupDateId: browseDate.pickupDateId,
                        pickupDate: browseDate.pickupDate,
                        scheduleId: browseDate.scheduleId,
                        scheduleKey: browseDate.scheduleKey,
                        scheduleLabelEn: browseDate.scheduleLabelEn,
                        scheduleLabelTh: browseDate.scheduleLabelTh,
                        scheduleLabelZh: browseDate.scheduleLabelZh,
                      })}
                      disabled={!browseDate}
                      className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-amber-600 border-amber-600 text-white shadow-md'
                          : browseDate
                            ? 'bg-amber-50 border-amber-200 text-gray-900 hover:bg-amber-100 hover:border-amber-400'
                            : 'bg-white border-transparent text-gray-300 cursor-default'
                      }`}
                    >
                      <span className="text-sm sm:text-base font-semibold">{date.getUTCDate()}</span>
                      {browseDate && (
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-gray-700">
                <span className="font-semibold">{selectedScheduleLabel}</span>
                <span className="text-gray-500"> · {selectedDate.availableProductCount} {language === 'th' ? 'สินค้า' : language === 'zh' ? '件商品' : 'products available'}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
