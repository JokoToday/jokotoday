import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, MapPin, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  getCustomerPickupAvailabilityV2,
  PickupAvailabilityLocation,
  PickupAvailabilityRow,
} from '../lib/pickupAvailabilityV2';

export interface PickupBrowseSelectionV2 {
  pickupDateId: string;
  pickupDate: string;
  pickupLocationId?: string | null;
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
  locations: PickupAvailabilityLocation[];
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

function localizedLocationName(location: PickupAvailabilityLocation, language: 'en' | 'th' | 'zh'): string {
  if (language === 'th') return location.name_th || location.name_en;
  if (language === 'zh') return location.name_zh || location.name_en;
  return location.name_en;
}

function localizedScheduleLabel(date: BrowseDate, language: 'en' | 'th' | 'zh'): string {
  if (language === 'th') return date.scheduleLabelTh || date.scheduleLabelEn;
  if (language === 'zh') return date.scheduleLabelZh || date.scheduleLabelEn;
  return date.scheduleLabelEn;
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
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [locationFilterId, setLocationFilterId] = useState<string>('all');

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
          locations: representative.locations,
        }];
      })
      .sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
  }, [rows]);

  const locations = useMemo(() => {
    const byId = new Map<string, PickupAvailabilityLocation>();
    browseDates.forEach((date) => {
      date.locations.forEach((location) => byId.set(location.id, location));
    });
    return Array.from(byId.values()).sort((a, b) => a.sort_order - b.sort_order);
  }, [browseDates]);

  const filteredBrowseDates = useMemo(
    () => locationFilterId === 'all'
      ? browseDates
      : browseDates.filter((date) => date.locations.some((location) => location.id === locationFilterId)),
    [browseDates, locationFilterId],
  );

  const browseDateById = useMemo(
    () => new Map(browseDates.map((date) => [date.pickupDateId, date])),
    [browseDates],
  );
  const dateIdByKey = useMemo(
    () => new Map(filteredBrowseDates.map((date) => [date.pickupDate, date.pickupDateId])),
    [filteredBrowseDates],
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
      const date = browseDateById.get(value.pickupDateId);
      if (value.pickupLocationId && !date?.locations.some((location) => location.id === value.pickupLocationId)) {
        onChange({ ...value, pickupLocationId: null });
        return;
      }
      setVisibleMonth(monthStart(utcDateFromKey(value.pickupDate)));
      return;
    }
    if (filteredBrowseDates.length > 0) {
      setVisibleMonth(monthStart(utcDateFromKey(filteredBrowseDates[0].pickupDate)));
    }
  }, [value?.pickupDateId, value?.pickupLocationId, browseDates, filteredBrowseDates, browseDateById]);

  const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
  const calendarMonthIndices = filteredBrowseDates.map(({ pickupDate }) => monthIndex(utcDateFromKey(pickupDate)));
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
    ? 'เลือกวันและสถานที่รับสินค้า'
    : language === 'zh'
      ? '选择取货日期和地点'
      : 'Choose pickup date and location';
  const helper = language === 'th'
    ? 'เลือกสถานที่และวันที่รับสินค้า เพื่อดูสินค้าที่สั่งได้สำหรับวันนั้น'
    : language === 'zh'
      ? '选择取货地点和日期，查看当天可以订购的商品。'
      : 'Choose a pickup location and date to browse the products available that day.';
  const allLocationsLabel = language === 'th' ? 'ทุกสถานที่' : language === 'zh' ? '全部地点' : 'All locations';
  const upcomingLabel = language === 'th' ? 'วันรับสินค้าที่กำลังจะมาถึง' : language === 'zh' ? '即将到来的取货日期' : 'Upcoming pickup dates';
  const fullCalendarLabel = language === 'th' ? 'ปฏิทินเต็ม' : language === 'zh' ? '完整日历' : 'Full calendar';

  const selectedDate = value ? browseDateById.get(value.pickupDateId) || null : null;
  const selectedScheduleLabel = selectedDate ? localizedScheduleLabel(selectedDate, language) : null;

  const selectDate = (browseDate: BrowseDate) => {
    const filteredLocation = locationFilterId !== 'all'
      ? browseDate.locations.find((location) => location.id === locationFilterId) || null
      : null;
    const automaticLocationId = filteredLocation?.id
      || (browseDate.locations.length === 1 ? browseDate.locations[0].id : null);
    onChange({
      pickupDateId: browseDate.pickupDateId,
      pickupDate: browseDate.pickupDate,
      pickupLocationId: automaticLocationId,
      scheduleId: browseDate.scheduleId,
      scheduleKey: browseDate.scheduleKey,
      scheduleLabelEn: browseDate.scheduleLabelEn,
      scheduleLabelTh: browseDate.scheduleLabelTh,
      scheduleLabelZh: browseDate.scheduleLabelZh,
    });
  };

  const selectLocation = (locationId: string) => {
    if (!value || !selectedDate) return;
    onChange({ ...value, pickupLocationId: locationId });
  };

  const changeLocationFilter = (nextLocationId: string) => {
    setLocationFilterId(nextLocationId);
    if (!value || nextLocationId === 'all') return;
    const selected = browseDateById.get(value.pickupDateId);
    if (!selected?.locations.some((location) => location.id === nextLocationId)) {
      onChange(null);
    }
  };

  const formatCompactDate = (value: string) => new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(utcDateFromKey(value));

  return (
    <div className="max-w-4xl mx-auto mb-8">
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
          <div className="bg-white/70 rounded-xl py-10 text-center text-sm text-gray-500">
            {language === 'th' ? 'กำลังโหลดวันรับสินค้า…' : language === 'zh' ? '正在加载取货日期…' : 'Loading pickup dates…'}
          </div>
        ) : browseDates.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-white px-4 py-5 text-sm text-gray-600">
            {language === 'th' ? 'ยังไม่มีวันรับสินค้าที่มีสินค้าให้สั่ง' : language === 'zh' ? '目前没有可订购商品的取货日期。' : 'No pickup dates currently have orderable products.'}
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-700" />
                {language === 'th' ? 'สถานที่รับสินค้า' : language === 'zh' ? '取货地点' : 'Pickup location'}
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

            <div className="rounded-xl border border-amber-100 bg-white p-3 sm:p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-gray-900">{upcomingLabel}</p>
                <button
                  type="button"
                  onClick={() => setShowFullCalendar((open) => !open)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-950"
                >
                  {fullCalendarLabel}
                  {showFullCalendar ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
                {filteredBrowseDates.slice(0, 12).map((date) => {
                  const selected = value?.pickupDateId === date.pickupDateId;
                  return (
                    <button
                      key={date.pickupDateId}
                      type="button"
                      onClick={() => selectDate(date)}
                      className={`min-w-[116px] snap-start rounded-xl border px-3 py-2.5 text-left transition-colors ${selected ? 'border-amber-600 bg-amber-600 text-white shadow-sm' : 'border-amber-200 bg-amber-50 text-gray-900 hover:bg-amber-100'}`}
                    >
                      <p className="text-sm font-semibold">{formatCompactDate(date.pickupDate)}</p>
                      <p className={`text-[11px] mt-1 truncate ${selected ? 'text-amber-50' : 'text-gray-500'}`}>
                        {localizedScheduleLabel(date, language)}
                      </p>
                    </button>
                  );
                })}
              </div>

              {filteredBrowseDates.length === 0 && (
                <p className="text-sm text-gray-500 py-3">
                  {language === 'th' ? 'ไม่มีวันรับสินค้าสำหรับสถานที่นี้ในขณะนี้' : language === 'zh' ? '该地点目前没有可用取货日期。' : 'No upcoming pickup dates are available for this location.'}
                </p>
              )}
            </div>

            {showFullCalendar && filteredBrowseDates.length > 0 && (
              <div className="mt-3 bg-white border border-amber-100 rounded-xl overflow-hidden shadow-sm">
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
                    <div key={`${label}-${index}`} className="text-center text-[10px] sm:text-[11px] font-semibold text-gray-400 py-1">
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 p-2 pt-1">
                  {calendarCells.map((date, index) => {
                    if (!date) return <div key={`blank-${index}`} className="h-11" />;
                    const key = dateKey(date);
                    const pickupDateId = dateIdByKey.get(key);
                    const browseDate = pickupDateId ? browseDateById.get(pickupDateId) || null : null;
                    const isSelected = Boolean(browseDate && value?.pickupDateId === browseDate.pickupDateId);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => browseDate && selectDate(browseDate)}
                        disabled={!browseDate}
                        className={`h-11 rounded-lg border flex flex-col items-center justify-center transition-all ${isSelected ? 'bg-amber-600 border-amber-600 text-white shadow-sm' : browseDate ? 'bg-amber-50 border-amber-200 text-gray-900 hover:bg-amber-100 hover:border-amber-400' : 'bg-white border-transparent text-gray-300 cursor-default'}`}
                      >
                        <span className="text-xs sm:text-sm font-semibold">{date.getUTCDate()}</span>
                        {browseDate && <span className={`mt-0.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedDate && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-gray-700">
                <div className="flex items-center gap-2 flex-wrap">
                  <MapPin className="w-4 h-4 text-amber-700" />
                  <span className="font-semibold">{selectedScheduleLabel}</span>
                  <span className="text-gray-500">· {selectedDate.availableProductCount} {language === 'th' ? 'สินค้า' : language === 'zh' ? '件商品' : 'products available'}</span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedDate.locations.map((location) => {
                    const selected = value?.pickupLocationId === location.id;
                    const name = localizedLocationName(location, language);
                    const description = language === 'th'
                      ? location.description_th || location.description_en
                      : language === 'zh'
                        ? location.description_zh || location.description_en
                        : location.description_en;
                    return (
                      <div key={location.id} className={`rounded-xl border overflow-hidden ${selected ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-300' : 'border-gray-200 bg-white'}`}>
                        <button type="button" onClick={() => selectLocation(location.id)} className="w-full text-left px-4 py-2.5 hover:bg-amber-50/50">
                          <p className="font-medium text-gray-900">{name}</p>
                          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
                        </button>
                        {location.maps_url && (
                          <a href={location.maps_url} target="_blank" rel="noreferrer" className="border-t border-gray-100 px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 flex items-center gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" />
                            {language === 'th' ? 'ดูแผนที่' : language === 'zh' ? '查看地图' : 'View map'}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
