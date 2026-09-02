import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  Minus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  CartAvailabilityRequirement,
  CommonPickupDateAvailability,
  getCommonPickupDates,
  getCustomerPickupAvailabilityV2,
  getPickupDateProductIssues,
  PickupAvailabilityLocation,
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
  onQuantityChange?: (productId: string, quantity: number) => void;
  onRemoveProduct?: (productId: string) => void;
}

type CalendarPickupDate = Omit<CommonPickupDateAvailability, 'remainingByProduct'>;

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

function localizedRequirementName(
  requirement: CartAvailabilityRequirement | undefined,
  language: 'en' | 'th' | 'zh',
): string {
  if (!requirement) return '';
  if (language === 'th') return requirement.nameTh || requirement.nameEn || requirement.productId;
  if (language === 'zh') return requirement.nameZh || requirement.nameEn || requirement.productId;
  return requirement.nameEn || requirement.productId;
}

function localizedLocationName(location: PickupAvailabilityLocation, language: 'en' | 'th' | 'zh'): string {
  if (language === 'th') return location.name_th || location.name_en;
  if (language === 'zh') return location.name_zh || location.name_en;
  return location.name_en;
}

export function PickupDateSelectorV2({
  requirements,
  value,
  onChange,
  onQuantityChange,
  onRemoveProduct,
}: PickupDateSelectorV2Props) {
  const { language } = useLanguage();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getCustomerPickupAvailabilityV2>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeDateId, setActiveDateId] = useState<string | null>(value?.pickupDateId || null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => monthStart(new Date()));
  const [locationFilterId, setLocationFilterId] = useState<string>('all');

  const productIds = useMemo(
    () => Array.from(new Set(requirements.map(({ productId }) => productId).filter(Boolean))).sort(),
    [requirements],
  );
  const productIdsKey = productIds.join(',');

  const requirementByProduct = useMemo(
    () => new Map(requirements.map((requirement) => [requirement.productId, requirement])),
    [requirements],
  );

  const commonDates = useMemo(
    () => getCommonPickupDates(rows, requirements),
    [rows, requirements],
  );

  const commonDateById = useMemo(() => {
    const map = new Map<string, CommonPickupDateAvailability>();
    commonDates.forEach((date) => map.set(date.pickupDateId, date));
    return map;
  }, [commonDates]);

  const calendarDates = useMemo<CalendarPickupDate[]>(() => {
    const byId = new Map<string, CalendarPickupDate>();
    rows.forEach((row) => {
      if (byId.has(row.pickup_date_id)) return;
      byId.set(row.pickup_date_id, {
        pickupDateId: row.pickup_date_id,
        pickupDate: row.pickup_date,
        orderCutoffAt: row.order_cutoff_at,
        scheduleId: row.schedule_id,
        scheduleKey: row.schedule_key,
        scheduleLabelEn: row.schedule_label_en,
        scheduleLabelTh: row.schedule_label_th,
        scheduleLabelZh: row.schedule_label_zh,
        locations: row.locations,
      });
    });
    return Array.from(byId.values()).sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
  }, [rows]);

  const locations = useMemo(() => {
    const byId = new Map<string, PickupAvailabilityLocation>();
    calendarDates.forEach((date) => date.locations.forEach((location) => byId.set(location.id, location)));
    return Array.from(byId.values()).sort((a, b) => a.sort_order - b.sort_order);
  }, [calendarDates]);

  const visibleCalendarDates = useMemo(
    () => locationFilterId === 'all'
      ? calendarDates
      : calendarDates.filter((date) => date.locations.some((location) => location.id === locationFilterId)),
    [calendarDates, locationFilterId],
  );

  const calendarDateById = useMemo(
    () => new Map(calendarDates.map((date) => [date.pickupDateId, date])),
    [calendarDates],
  );

  const loadAvailability = async () => {
    if (productIds.length === 0) {
      setRows([]);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Load the full safe customer horizon so otherwise-unavailable dates can
      // still be inspected and explained without exposing private inventory data.
      setRows(await getCustomerPickupAvailabilityV2());
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Could not load pickup availability.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAvailability();
  }, [productIdsKey]);

  useEffect(() => {
    if (value) {
      const selectedDate = commonDateById.get(value.pickupDateId);
      const locationStillActive = selectedDate?.locations.some((location) => location.id === value.pickupLocationId);
      if (!selectedDate || !locationStillActive) {
        onChange(null);
        return;
      }
      if (activeDateId === null) setActiveDateId(value.pickupDateId);
      setVisibleMonth(monthStart(utcDateFromKey(value.pickupDate)));
      return;
    }

    if (calendarDates.length > 0 && activeDateId === null) {
      setVisibleMonth(monthStart(utcDateFromKey(calendarDates[0].pickupDate)));
    }
  }, [value?.pickupDateId, value?.pickupLocationId, commonDates, commonDateById, calendarDates, activeDateId]);

  const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
  const activeCalendarDate = activeDateId ? calendarDateById.get(activeDateId) || null : null;
  const activeCommonDate = activeDateId ? commonDateById.get(activeDateId) || null : null;
  const activeIssues = useMemo(
    () => activeDateId ? getPickupDateProductIssues(rows, requirements, activeDateId) : [],
    [rows, requirements, activeDateId],
  );

  const committedLocation = useMemo(() => {
    if (!value?.pickupLocationId) return null;
    for (const row of rows) {
      const found = row.locations.find((location) => location.id === value.pickupLocationId);
      if (found) return found;
    }
    return null;
  }, [rows, value?.pickupLocationId]);
  const committedLocationUnavailableOnDraft = Boolean(
    activeCalendarDate
      && value?.pickupLocationId
      && activeCalendarDate.pickupDateId !== value.pickupDateId
      && !activeCalendarDate.locations.some((location) => location.id === value.pickupLocationId),
  );

  const calendarMonthIndices = visibleCalendarDates.map(({ pickupDate }) => monthIndex(utcDateFromKey(pickupDate)));
  const currentMonthIndex = monthIndex(visibleMonth);
  const minMonthIndex = calendarMonthIndices.length > 0 ? Math.min(...calendarMonthIndices) : currentMonthIndex;
  const maxMonthIndex = calendarMonthIndices.length > 0 ? Math.max(...calendarMonthIndices) : currentMonthIndex;

  const dateIdByKey = useMemo(
    () => new Map(visibleCalendarDates.map((date) => [date.pickupDate, date.pickupDateId])),
    [visibleCalendarDates],
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

  const handleDateSelection = (date: CalendarPickupDate) => {
    setActiveDateId(date.pickupDateId);
    setVisibleMonth(monthStart(utcDateFromKey(date.pickupDate)));
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

  const changeLocationFilter = (nextLocationId: string) => {
    setLocationFilterId(nextLocationId);
    if (nextLocationId === 'all') return;
    if (activeCalendarDate?.locations.some((location) => location.id === nextLocationId)) return;
    const firstDate = calendarDates.find((date) => date.locations.some((location) => location.id === nextLocationId));
    if (firstDate) {
      setActiveDateId(firstDate.pickupDateId);
      setVisibleMonth(monthStart(utcDateFromKey(firstDate.pickupDate)));
    }
  };

  const title = language === 'th'
    ? 'เลือกวันและสถานที่รับสินค้า'
    : language === 'zh'
      ? '选择取货日期和地点'
      : 'Choose pickup date and location';
  const helper = language === 'th'
    ? 'เลือกสถานที่หรือวันที่ใหม่ได้ โดยการรับสินค้าที่คุณยืนยันไว้จะยังไม่เปลี่ยนจนกว่าคุณจะเลือกสถานที่สำหรับวันใหม่'
    : language === 'zh'
      ? '您可以先查看新的地点或日期；在为新日期选择取货地点之前，原已确认的取货安排不会改变。'
      : 'Explore another location or date first. Your confirmed pickup stays unchanged until you choose a location for the new date.';
  const allLocationsLabel = language === 'th' ? 'ทุกสถานที่' : language === 'zh' ? '全部地点' : 'All locations';

  return (
    <div className="max-w-3xl mx-auto mb-8">
      <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4 sm:p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
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
            disabled={loading || productIds.length === 0}
            className="p-2 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
            aria-label="Refresh pickup availability"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="bg-white/70 rounded-xl py-10 text-center text-sm text-gray-500">
            {language === 'th' ? 'กำลังโหลดวันรับสินค้า…' : language === 'zh' ? '正在加载取货日期…' : 'Loading pickup dates…'}
          </div>
        ) : productIds.length === 0 ? (
          <div className="bg-white/70 rounded-xl py-10 text-center text-sm text-gray-500">
            {language === 'th' ? 'เพิ่มสินค้าในตะกร้าก่อนเลือกวันรับสินค้า' : language === 'zh' ? '请先将商品加入购物车。' : 'Add products to your cart before choosing a pickup date.'}
          </div>
        ) : calendarDates.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-white px-4 py-5 text-sm text-gray-600">
            {language === 'th' ? 'ยังไม่มีวันรับสินค้าที่เปิดให้สั่ง' : language === 'zh' ? '目前没有可订购的取货日期。' : 'No orderable pickup dates are currently available.'}
          </div>
        ) : (
          <>
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-700" />
                {language === 'th' ? 'เลือกสถานที่' : language === 'zh' ? '选择地点' : 'Choose location'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => changeLocationFilter('all')}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${locationFilterId === 'all' ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-200 bg-white text-gray-700 hover:bg-amber-50'}`}
                >
                  {allLocationsLabel}
                </button>
                {locations.map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => changeLocationFilter(location.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${locationFilterId === location.id ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-200 bg-white text-gray-700 hover:bg-amber-50'}`}
                  >
                    {localizedLocationName(location, language)}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-amber-100 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-3 py-2 border-b border-amber-100">
                <button
                  type="button"
                  onClick={() => setVisibleMonth(monthFromIndex(currentMonthIndex - 1))}
                  disabled={currentMonthIndex <= minMonthIndex}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-amber-50 disabled:opacity-25"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-semibold text-gray-900 capitalize">
                  {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(visibleMonth)}
                </p>
                <button
                  type="button"
                  onClick={() => setVisibleMonth(monthFromIndex(currentMonthIndex + 1))}
                  disabled={currentMonthIndex >= maxMonthIndex}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-amber-50 disabled:opacity-25"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 px-2 pt-2">
                {weekdayLabels.map((label, index) => (
                  <div key={`${label}-${index}`} className="text-center text-[10px] sm:text-[11px] font-semibold text-gray-400 py-1">{label}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 p-2 pt-1">
                {calendarCells.map((date, index) => {
                  if (!date) return <div key={`blank-${index}`} className="h-12" />;
                  const key = dateKey(date);
                  const pickupDateId = dateIdByKey.get(key);
                  const calendarDate = pickupDateId ? calendarDateById.get(pickupDateId) || null : null;
                  const selectableDate = pickupDateId ? commonDateById.get(pickupDateId) || null : null;
                  const isActive = Boolean(calendarDate && activeDateId === calendarDate.pickupDateId);
                  const isCommitted = Boolean(value && calendarDate && value.pickupDateId === calendarDate.pickupDateId);
                  const pendingValid = isActive && !isCommitted && Boolean(selectableDate);
                  const pendingInvalid = isActive && !isCommitted && !selectableDate;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => calendarDate && handleDateSelection(calendarDate)}
                      disabled={!calendarDate}
                      className={`h-12 rounded-lg border flex flex-col items-center justify-center transition-all ${
                        isCommitted
                          ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                          : pendingValid
                            ? 'bg-amber-200 border-amber-500 text-amber-950 ring-2 ring-amber-200'
                            : pendingInvalid
                              ? 'bg-orange-200 border-orange-500 text-orange-950 ring-2 ring-orange-200'
                              : selectableDate
                                ? 'bg-amber-50 border-amber-200 text-gray-900 hover:bg-amber-100 hover:border-amber-400'
                                : calendarDate
                                  ? 'bg-orange-50 border-orange-100 text-orange-700 hover:bg-orange-100 hover:border-orange-300'
                                  : 'bg-white border-transparent text-gray-300 cursor-default'
                      }`}
                      aria-label={calendarDate ? `${key}${selectableDate ? '' : ' - needs basket adjustment'}` : key}
                    >
                      <span className="text-xs sm:text-sm font-semibold">{date.getUTCDate()}</span>
                      {calendarDate && (
                        <span className={`mt-0.5 w-1 h-1 rounded-full ${isCommitted ? 'bg-white' : selectableDate ? 'bg-green-500' : 'bg-orange-400'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {commonDates.length === 0 && !activeCalendarDate && (
              <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm text-orange-800">
                {language === 'th'
                  ? 'ยังไม่มีวันที่ที่รองรับตะกร้าทั้งหมด เลือกวันที่สีส้มเพื่อดูว่าสินค้าใดต้องปรับ'
                  : language === 'zh'
                    ? '目前没有日期能满足整个购物篮。请选择橙色日期查看需要调整的商品。'
                    : 'No date currently fits the complete basket. Open an orange date to see exactly what needs to change.'}
              </div>
            )}

            {activeCalendarDate && (
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
                      }).format(utcDateFromKey(activeCalendarDate.pickupDate))}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {language === 'th'
                        ? activeCalendarDate.scheduleLabelTh || activeCalendarDate.scheduleLabelEn
                        : language === 'zh'
                          ? activeCalendarDate.scheduleLabelZh || activeCalendarDate.scheduleLabelEn
                          : activeCalendarDate.scheduleLabelEn}
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
                    }).format(new Date(activeCalendarDate.orderCutoffAt))}
                  </div>
                </div>

                {activeIssues.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-orange-950">
                          {language === 'th'
                            ? 'วันนี้ยังไม่รองรับคำสั่งซื้อทั้งหมดของคุณ'
                            : language === 'zh'
                              ? '这个日期暂时无法满足您的完整订单'
                              : 'This date does not fit your complete order yet'}
                        </p>
                        <p className="text-xs text-orange-800 mt-1">
                          {language === 'th'
                            ? 'ปรับสินค้าด้านล่างหรือเลือกวันอื่น ระบบจะตรวจสอบวันที่นี้ใหม่ทันทีหลังทุกการเปลี่ยนแปลง'
                            : language === 'zh'
                              ? '请调整下方商品或选择其他日期。每次修改购物篮后，系统都会立即重新检查该日期。'
                              : 'Adjust the items below or choose another date. This date is rechecked immediately after every basket change.'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {activeIssues.map((issue) => {
                        const requirement = requirementByProduct.get(issue.productId);
                        const name = localizedRequirementName(requirement, language);
                        return (
                          <div key={issue.productId} className="rounded-lg border border-orange-100 bg-white px-3 py-3">
                            <p className="text-sm font-semibold text-gray-900">{name}</p>
                            {issue.reason === 'insufficient_quantity' ? (
                              <>
                                <p className="text-xs text-gray-600 mt-1">
                                  {language === 'th'
                                    ? `คุณต้องการ ${issue.requestedQuantity} · มี ${issue.availableQuantity} สำหรับวันนี้`
                                    : language === 'zh'
                                      ? `您需要 ${issue.requestedQuantity} · 当天仅有 ${issue.availableQuantity}`
                                      : `You need ${issue.requestedQuantity} · ${issue.availableQuantity} available for this date`}
                                </p>
                                {onQuantityChange && issue.availableQuantity > 0 && (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => onQuantityChange(issue.productId, issue.availableQuantity)}
                                      className="rounded-lg bg-orange-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-800"
                                    >
                                      {language === 'th'
                                        ? `ลดเหลือ ${issue.availableQuantity}`
                                        : language === 'zh'
                                          ? `减少到 ${issue.availableQuantity}`
                                          : `Reduce to ${issue.availableQuantity}`}
                                    </button>
                                    {issue.requestedQuantity > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => onQuantityChange(issue.productId, Math.max(1, issue.requestedQuantity - 1))}
                                        className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-xs font-medium text-orange-800 hover:bg-orange-50"
                                      >
                                        <Minus className="w-3.5 h-3.5" />
                                        {language === 'th' ? 'ลดทีละ 1' : language === 'zh' ? '减少 1 件' : 'Reduce by 1'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <p className="text-xs text-gray-600 mt-1">
                                  {language === 'th'
                                    ? 'สินค้านี้ไม่มีให้รับในวันที่เลือก'
                                    : language === 'zh'
                                      ? '该商品在所选日期不提供取货。'
                                      : 'This product is not offered on the selected date.'}
                                </p>
                                {onRemoveProduct && (
                                  <button
                                    type="button"
                                    onClick={() => onRemoveProduct(issue.productId)}
                                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {language === 'th' ? 'นำออกจากตะกร้า' : language === 'zh' ? '从购物篮移除' : 'Remove from basket'}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : activeCommonDate ? (
                  <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-2 text-sm text-green-800">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      {language === 'th'
                        ? 'สินค้าทั้งหมดในตะกร้ามีจำนวนเพียงพอสำหรับวันนี้ เลือกจุดรับสินค้าด้านล่างเพื่อยืนยันการเปลี่ยนแปลง'
                        : language === 'zh'
                          ? '购物篮中的所有商品在该日期都有足够库存。请在下方选择取货地点以确认更改。'
                          : 'Everything in your basket is available for this date. Choose a pickup location below to confirm the change.'}
                    </span>
                  </div>
                ) : null}

                {committedLocationUnavailableOnDraft && committedLocation && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {language === 'th'
                      ? `${localizedLocationName(committedLocation, language)} ไม่มีให้รับในวันนี้ กรุณาเลือกสถานที่ด้านล่างหรือวันอื่น`
                      : language === 'zh'
                        ? `${localizedLocationName(committedLocation, language)} 在该日期不提供取货。请选择下方地点或其他日期。`
                        : `${localizedLocationName(committedLocation, language)} is not offered on this date. Choose one of the locations below or another date.`}
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-700" />
                    {language === 'th' ? 'จุดรับสินค้า' : language === 'zh' ? '取货地点' : 'Pickup location'}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activeCalendarDate.locations.map((location) => {
                      const isLocationSelected = value?.pickupDateId === activeCalendarDate.pickupDateId
                        && value.pickupLocationId === location.id;
                      const name = localizedLocationName(location, language);
                      const description = language === 'th'
                        ? location.description_th || location.description_en
                        : language === 'zh'
                          ? location.description_zh || location.description_en
                          : location.description_en;
                      const canSelectLocation = Boolean(activeCommonDate);

                      return (
                        <div
                          key={location.id}
                          className={`rounded-xl border overflow-hidden ${isLocationSelected ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-300' : 'border-gray-200 bg-white'}`}
                        >
                          <button
                            type="button"
                            onClick={() => activeCommonDate && selectLocation(activeCommonDate, location.id)}
                            disabled={!canSelectLocation}
                            className="w-full text-left px-4 py-3 transition-colors hover:bg-amber-50/50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <p className="font-medium text-gray-900">{name}</p>
                            {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
                            {canSelectLocation && !isLocationSelected && (
                              <p className="text-xs font-medium text-amber-700 mt-1.5">
                                {language === 'th' ? 'เลือกสถานที่นี้' : language === 'zh' ? '选择此地点' : 'Use this location'}
                              </p>
                            )}
                          </button>
                          {location.maps_url && (
                            <a
                              href={location.maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="border-t border-gray-100 px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 flex items-center gap-1.5"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              {language === 'th' ? 'ดูแผนที่' : language === 'zh' ? '查看地图' : 'View map'}
                            </a>
                          )}
                        </div>
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
