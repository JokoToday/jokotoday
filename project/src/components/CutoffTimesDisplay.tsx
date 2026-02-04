import { useEffect, useState } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { getCutoffRules, getPickupOverrides, getOverrideForDate, CutoffRule, PickupOverride } from '../lib/availabilityService';

interface CutoffTimesDisplayProps {
  language: 'en' | 'th';
}

function isCutoffToday(cutoffDay: string): boolean {
  const dayMap: Record<string, number> = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
  };

  const cutoffDayOfWeek = dayMap[cutoffDay];
  if (cutoffDayOfWeek === undefined) return false;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
  });

  const todayName = formatter.format(new Date());
  return todayName === cutoffDay;
}

function isCutoffPassed(cutoffDay: string, cutoffTime: string): boolean {
  const dayMap: Record<string, number> = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
  };

  const cutoffDayOfWeek = dayMap[cutoffDay];
  if (cutoffDayOfWeek === undefined) return true;

  const [hours, minutes] = cutoffTime.split(':').map(Number);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const partsMap: Record<string, string> = {};
  parts.forEach((part) => {
    partsMap[part.type] = part.value;
  });

  const nowInBangkok = new Date(
    parseInt(partsMap.year),
    parseInt(partsMap.month) - 1,
    parseInt(partsMap.day),
    parseInt(partsMap.hour),
    parseInt(partsMap.minute),
    parseInt(partsMap.second)
  );

  const currentDayOfWeek = nowInBangkok.getDay();
  let cutoffDate = new Date(nowInBangkok);

  if (cutoffDayOfWeek <= currentDayOfWeek) {
    const daysBack = currentDayOfWeek - cutoffDayOfWeek;
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  } else {
    const daysForward = cutoffDayOfWeek - currentDayOfWeek;
    cutoffDate.setDate(cutoffDate.getDate() + daysForward);
  }

  cutoffDate.setHours(hours, minutes, 0, 0);
  return nowInBangkok > cutoffDate;
}

export function CutoffTimesDisplay({ language }: CutoffTimesDisplayProps) {
  const [rules, setRules] = useState<CutoffRule[]>([]);
  const [overrides, setOverrides] = useState<PickupOverride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [rulesData, overridesData] = await Promise.all([
        getCutoffRules(),
        getPickupOverrides(),
      ]);
      setRules(rulesData);
      setOverrides(overridesData);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading || rules.length === 0) {
    return null;
  }

  const today = new Date();
  const isThailand = language === 'th';

  const getStatusBadge = (rule: CutoffRule) => {
    const override = getOverrideForDate(overrides, today, rule.pickup_day, rule.location);

    if (override?.override_type === 'closed') {
      return {
        text: isThailand ? 'ปิดรับออเดอร์' : 'Closed',
        color: 'bg-red-100 text-red-700 border-red-300',
        icon: null,
      };
    }

    if (override?.override_type === 'sold_out') {
      return {
        text: isThailand ? 'ขายหมดแล้ว' : 'Sold Out',
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        icon: null,
      };
    }

    const cutoffDay = override?.override_type === 'custom_cutoff' && override.custom_cutoff_day
      ? override.custom_cutoff_day
      : rule.cutoff_day;

    const cutoffTime = override?.override_type === 'custom_cutoff' && override.custom_cutoff_time
      ? override.custom_cutoff_time
      : rule.cutoff_time;

    const passed = isCutoffPassed(cutoffDay, cutoffTime);
    const isToday = isCutoffToday(cutoffDay);

    if (passed) {
      return {
        text: isThailand ? 'ปิดรับออเดอร์แล้ว' : 'Closed for this pickup',
        color: 'bg-red-50 text-red-600 border-red-200',
        icon: 'alert',
      };
    }

    if (isToday) {
      return {
        text: isThailand ? `ปิดวันนี้ ${cutoffTime} น.` : `Closes today at ${cutoffTime}`,
        color: 'bg-amber-100 text-amber-700 border-amber-300',
        icon: 'clock',
      };
    }

    return {
      text: isThailand ? 'เปิดรับออเดอร์' : 'Open',
      color: 'bg-green-100 text-green-700 border-green-300',
      icon: null,
    };
  };

  return (
    <div className="w-full">
      <p className="text-sm text-gray-600 mb-4 text-center">
        {isThailand
          ? 'สั่งสินค้าภายในเวลาปิดรับออเดอร์ของแต่ละรอบ'
          : 'Place your order before the respective cut-off times (see Products page).'}
      </p>

      <div className="space-y-3">
        {rules.map((rule) => {
          const override = getOverrideForDate(overrides, today, rule.pickup_day, rule.location);

          const cutoffDay = override?.override_type === 'custom_cutoff' && override.custom_cutoff_day
            ? override.custom_cutoff_day
            : rule.cutoff_day;

          const cutoffTime = override?.override_type === 'custom_cutoff' && override.custom_cutoff_time
            ? override.custom_cutoff_time
            : rule.cutoff_time;

          const label = isThailand ? rule.pickup_label_th : rule.pickup_label_en;
          const status = getStatusBadge(rule);

          return (
            <div
              key={rule.id}
              className="bg-white border-2 border-amber-100 rounded-xl p-4 hover:border-amber-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm md:text-base mb-1">
                    {label}
                  </p>
                  <p className="text-xs md:text-sm text-gray-600">
                    {isThailand
                      ? `สั่งก่อน ${cutoffDay} เวลา ${cutoffTime} น.`
                      : `Order by ${cutoffDay} ${cutoffTime}`}
                  </p>
                </div>

                <div className={`px-3 py-1.5 rounded-lg border-2 font-medium text-xs md:text-sm whitespace-nowrap flex items-center gap-1.5 ${status.color}`}>
                  {status.icon === 'clock' && <Clock className="w-4 h-4" />}
                  {status.icon === 'alert' && <AlertCircle className="w-4 h-4" />}
                  {status.text}
                </div>
              </div>

              {override?.note_en && (
                <p className="text-xs text-orange-600 mt-2">
                  {isThailand ? override.note_th : override.note_en}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
