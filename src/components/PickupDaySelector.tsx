import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, MapPin } from 'lucide-react';
import {
  getBangkokCalendarDate,
  getPickupDays,
  getPickupOverrides,
  getOverrideForDate,
  getPickupDayLabel,
  getNextPickupDate,
  isDayOpenForOrdering,
  PickupDay,
  PickupOverride,
} from '../lib/availabilityService';
import { CountdownTimer } from './CountdownTimer';
import { useLanguage } from '../context/LanguageContext';

interface PickupDaySelectorProps {
  selectedPickupDay: string | null;
  onPickupDayChange: (day: string | null) => void;
  availableDays: string[];
  closedDays: string[];
}

type DatedPickupSlot = {
  day: PickupDay;
  date: Date;
  dateKey: string;
  closed: boolean;
  soldOut: boolean;
  selectable: boolean;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function matchesConfiguredDay(values: string[], day: PickupDay): boolean {
  const candidates = [day.day_key, day.label, day.label_en, day.label_th, day.label_zh]
    .filter((value): value is string => Boolean(value));
  return candidates.some((candidate) => values.includes(candidate));
}

function dateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
}

function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function monthFromIndex(index: number): Date {
  const year = Math.floor(index / 12);
  const month = index % 12;
  return new Date(Date.UTC(year, month, 1, 12));
}

function getCutoffDateForSlot(slot: DatedPickupSlot): Date | null {
  const cutoffWeekday = WEEKDAY_INDEX[slot.day.cutoff_day];
  if (cutoffWeekday === undefined) return null;

  const daysBeforePickup = (slot.day.pickup_weekday - cutoffWeekday + 7) % 7;
  const cutoffDate = new Date(slot.date);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - daysBeforePickup);
  return cutoffDate;
}

export function PickupDaySelector({
  selectedPickupDay,
  onPickupDayChange,
  availableDays,
  closedDays,
}: PickupDaySelectorProps) {
  const { t, language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);
  const [overrides, setOverrides] = useState<PickupOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => monthStart(getBangkokCalendarDate()));

  useEffect(() => {
    const fetchData = async () => {
      const [daysData, overridesData] = await Promise.all([
        getPickupDays(),
        getPickupOverrides(),
      ]);
      setPickupDays(daysData);
      setOverrides(overridesData);
      setLoading(false);
    };
    fetchData();
  }, []);

  const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
  const headerText = language === 'th'
    ? 'เลือกวันที่รับสินค้า'
    : language === 'zh'
      ? '选择取货日期'
      : 'Choose your pickup date';
  const helperText = language === 'th'
    ? 'เลือกวันที่ในปฏิทิน แล้วเลือกจุดรับสินค้าหากมีมากกว่าหนึ่งรอบ'
    : language === 'zh'
      ? '请在日历中选择日期；若当天有多个取货时段，再选择所需时段。'
      : 'Select a date on the calendar. If more than one pickup slot is offered that day, choose the slot below.';

  const getOverride = (day: PickupDay): PickupOverride | null => {
    const rule = day.cutoff_rule;
    const pickupDate = getNextPickupDate(day);
    if (!rule || !pickupDate) return null;
    return getOverrideForDate(overrides, pickupDate, rule.pickup_day, rule.location);
  };

  const isClosed = (day: PickupDay): boolean => {
    const override = getOverride(day);
    if (override?.override_type === 'closed' || override?.override_type === 'sold_out') return true;
    return !isDayOpenForOrdering(day) || matchesConfiguredDay(closedDays, day);
  };

  const isSoldOut = (day: PickupDay): boolean => {
    if (availableDays.length === 0) return false;
    return !matchesConfiguredDay(availableDays, day) && !isClosed(day);
  };

  const datedSlots = useMemo<DatedPickupSlot[]>(() => pickupDays
    .map((day) => {
      const date = getNextPickupDate(day);
      if (!date) return null;
      const closed = isClosed(day);
      const soldOut = isSoldOut(day);
      return {
        day,
        date,
        dateKey: dateKey(date),
        closed,
        soldOut,
        selectable: !closed && !soldOut,
      };
    })
    .filter((slot): slot is DatedPickupSlot => slot !== null), [pickupDays, overrides, availableDays, closedDays]);

  const selectedSlot = datedSlots.find(({ day }) =>
    day.day_key === selectedPickupDay || day.label === selectedPickupDay,
  ) || null;

  useEffect(() => {
    if (selectedSlot) {
      setSelectedCalendarDate(selectedSlot.dateKey);
      setVisibleMonth(monthStart(selectedSlot.date));
      return;
    }

    const firstSelectable = datedSlots.find((slot) => slot.selectable) || datedSlots[0];
    if (firstSelectable && selectedCalendarDate === null) {
      setVisibleMonth(monthStart(firstSelectable.date));
    }
  }, [selectedSlot?.day.id, datedSlots.length]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, DatedPickupSlot[]>();
    datedSlots.forEach((slot) => {
      const current = map.get(slot.dateKey) || [];
      current.push(slot);
      map.set(slot.dateKey, current);
    });
    return map;
  }, [datedSlots]);

  const selectedDateSlots = selectedCalendarDate ? slotsByDate.get(selectedCalendarDate) || [] : [];

  const monthIndices = datedSlots.map((slot) => monthIndex(slot.date));
  const minMonthIndex = monthIndices.length > 0 ? Math.min(...monthIndices) : monthIndex(visibleMonth);
  const maxMonthIndex = monthIndices.length > 0 ? Math.max(...monthIndices) : monthIndex(visibleMonth);
  const currentMonthIndex = monthIndex(visibleMonth);

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
  const calendarCellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const calendarCells = Array.from({ length: calendarCellCount }, (_, index) => {
    const dayNumber = index - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) return null;
    return new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), dayNumber, 12));
  });

  const weekdayLabels = Array.from({ length: 7 }, (_, weekday) => {
    const date = new Date(Date.UTC(2026, 7, 23 + weekday, 12));
    return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date);
  });

  const formatLongDate = (date: Date) => new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);

  const formatCutoffDate = (slot: DatedPickupSlot): string => {
    const cutoffDate = getCutoffDateForSlot(slot);
    if (!cutoffDate) return slot.day.cutoff_day;
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(cutoffDate);
  };

  const formatCutoffText = (slot: DatedPickupSlot): string => {
    const cutoffDate = formatCutoffDate(slot);
    if (language === 'th') return `สั่งก่อน ${cutoffDate} เวลา ${slot.day.cutoff_time} น.`;
    if (language === 'zh') return `截止：${cutoffDate} ${slot.day.cutoff_time}`;
    return `Order by ${cutoffDate} · ${slot.day.cutoff_time}`;
  };

  const handleDateSelection = (key: string) => {
    const slots = slotsByDate.get(key) || [];
    if (!slots.some((slot) => slot.selectable)) return;

    setSelectedCalendarDate(key);
    const selectable = slots.filter((slot) => slot.selectable);
    if (selectable.length === 1) {
      onPickupDayChange(selectable[0].day.day_key);
    } else if (!selectable.some((slot) => slot.day.day_key === selectedPickupDay)) {
      onPickupDayChange(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mb-8">
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-2 border-amber-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{headerText}</h2>
            <p className="text-sm text-gray-600 mt-1">{helperText}</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white/70 rounded-xl py-12 text-center text-sm text-gray-500">
            {language === 'th' ? 'กำลังโหลดวันรับสินค้า…' : language === 'zh' ? '正在加载取货日期…' : 'Loading pickup dates…'}
          </div>
        ) : pickupDays.length === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {language === 'th'
              ? 'ยังไม่มีรอบรับสินค้าที่เปิดใช้งาน'
              : language === 'zh'
                ? '目前没有已配置的取货时段。'
                : 'No pickup slots are currently configured.'}
          </div>
        ) : (
          <>
            <div className="bg-white border border-amber-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100">
                <button
                  type="button"
                  onClick={() => setVisibleMonth(monthFromIndex(currentMonthIndex - 1))}
                  disabled={currentMonthIndex <= minMonthIndex}
                  className="p-2 rounded-lg text-gray-600 hover:bg-amber-50 disabled:opacity-25 disabled:cursor-not-allowed"
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
                  className="p-2 rounded-lg text-gray-600 hover:bg-amber-50 disabled:opacity-25 disabled:cursor-not-allowed"
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
                  const slots = slotsByDate.get(key) || [];
                  const selectableSlots = slots.filter((slot) => slot.selectable);
                  const hasSlots = slots.length > 0;
                  const isSelectableDate = selectableSlots.length > 0;
                  const isSelectedDate = key === selectedCalendarDate;
                  const hasClosedSlot = hasSlots && !isSelectableDate;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleDateSelection(key)}
                      disabled={!isSelectableDate}
                      className={`aspect-square rounded-xl border flex flex-col items-center justify-center relative transition-all ${
                        isSelectedDate
                          ? 'bg-amber-600 border-amber-600 text-white shadow-md'
                          : isSelectableDate
                            ? 'bg-amber-50 border-amber-200 text-gray-900 hover:bg-amber-100 hover:border-amber-400'
                            : hasClosedSlot
                              ? 'bg-red-50 border-red-100 text-gray-400 cursor-not-allowed'
                              : 'bg-white border-transparent text-gray-300 cursor-default'
                      }`}
                    >
                      <span className="text-sm sm:text-base font-semibold">{date.getUTCDate()}</span>
                      {hasSlots && (
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full ${isSelectedDate ? 'bg-white' : isSelectableDate ? 'bg-green-500' : 'bg-red-400'}`} />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="px-4 pb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />{language === 'th' ? 'เลือกได้' : language === 'zh' ? '可选择' : 'Available'}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />{language === 'th' ? 'ปิดรับแล้ว' : language === 'zh' ? '已截止' : 'Closed'}</span>
              </div>
            </div>

            {selectedCalendarDate && selectedDateSlots.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900">
                  {formatLongDate(selectedDateSlots[0].date)}
                </p>

                {selectedDateSlots.map((slot) => {
                  const { day } = slot;
                  const label = getPickupDayLabel(day, language);
                  const selected = day.day_key === selectedPickupDay || day.label === selectedPickupDay;
                  const rule = day.cutoff_rule;

                  return (
                    <button
                      key={day.id}
                      type="button"
                      disabled={!slot.selectable}
                      onClick={() => onPickupDayChange(day.day_key)}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                        selected
                          ? 'border-amber-500 bg-white shadow-sm'
                          : slot.selectable
                            ? 'border-amber-100 bg-white hover:border-amber-300'
                            : 'border-red-100 bg-red-50 opacity-70 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-amber-600" />
                            <span className="font-semibold text-gray-900">{label}</span>
                          </div>
                          {rule && (
                            <p className="text-xs text-gray-500 mt-2 ml-6">
                              {formatCutoffText(slot)}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          slot.selectable
                            ? selected ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {slot.selectable
                            ? selected
                              ? language === 'th' ? 'เลือกแล้ว' : language === 'zh' ? '已选择' : 'Selected'
                              : language === 'th' ? 'ว่าง' : language === 'zh' ? '可预订' : 'Available'
                            : language === 'th' ? 'ปิดรับแล้ว' : language === 'zh' ? '不可预订' : 'Closed'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedSlot && (
              <div className="mt-4 rounded-xl bg-white/80 border border-amber-200 p-4">
                <p className="text-xs uppercase tracking-wider font-semibold text-amber-700 mb-1">
                  {language === 'th' ? 'วันที่รับสินค้าที่เลือก' : language === 'zh' ? '已选择取货日期' : 'Selected pickup'}
                </p>
                <p className="font-semibold text-gray-900">{formatLongDate(selectedSlot.date)}</p>
                <p className="text-sm text-gray-600 mt-1">{getPickupDayLabel(selectedSlot.day, language)}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors group"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
              ) : (
                <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
              )}
              <span>{language === 'th' ? 'ดูรายละเอียดเวลาปิดรับออเดอร์' : language === 'zh' ? '查看截止时间详情' : 'View cutoff details'}</span>
            </button>

            {isExpanded && (
              <div className="mt-4 space-y-3 animate-fadeIn">
                {datedSlots.map((slot) => {
                  const { day } = slot;
                  const rule = day.cutoff_rule;
                  const override = getOverride(day);
                  const label = getPickupDayLabel(day, language);

                  if (!rule) {
                    return (
                      <div key={day.id} className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                        <p className="font-semibold text-gray-900 text-sm mb-1">{label}</p>
                        <p className="text-xs text-red-700 font-medium">Cutoff rule not configured</p>
                      </div>
                    );
                  }

                  if (override && (override.override_type === 'closed' || override.override_type === 'sold_out')) {
                    return (
                      <div key={day.id} className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                        <p className="font-semibold text-gray-900 text-sm mb-1">{label}</p>
                        <p className="text-xs text-red-700 font-medium">
                          {language === 'th' ? 'ปิดรับออเดอร์' : language === 'zh' ? '此取货时段不可用' : 'Unavailable for this pickup'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div key={day.id} className="bg-white border-2 border-amber-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{label}</p>
                          <p className="text-xs text-amber-700 font-medium mt-1">{formatLongDate(slot.date)}</p>
                        </div>
                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-2">
                        <p className="text-xs text-gray-600">
                          {formatCutoffText(slot)}
                        </p>
                        <CountdownTimer
                          cutoffDay={day.cutoff_day}
                          cutoffTime={day.cutoff_time}
                          pickupWeekday={day.pickup_weekday}
                          language={language}
                          compact
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!selectedPickupDay && (
              <p className="text-center text-gray-600 text-sm mt-4 bg-white/50 rounded-lg p-3">
                {t.pickupDay.selectDayHelper}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
