import { useEffect, useState } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { getPickupDays, isDayOpenForOrdering, PickupDay } from '../lib/availabilityService';

interface CutoffTimesDisplayProps {
  language: 'en' | 'th' | 'zh';
}

function getBangkokWeekdayName(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
  }).format(new Date());
}

export function CutoffTimesDisplay({ language }: CutoffTimesDisplayProps) {
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPickupDays()
      .then(setPickupDays)
      .catch((error) => console.error('Error loading pickup schedule:', error))
      .finally(() => setLoading(false));
  }, []);

  if (loading || pickupDays.length === 0) {
    return null;
  }

  const isThailand = language === 'th';
  const isChinese = language === 'zh';
  const todayName = getBangkokWeekdayName();

  const getStatusBadge = (day: PickupDay) => {
    if (day.override?.override_type === 'closed') {
      return {
        text: isThailand ? 'ปิดรับออเดอร์' : isChinese ? '已停止接单' : 'Closed',
        color: 'bg-red-100 text-red-700 border-red-300',
        icon: null,
      };
    }

    if (day.override?.override_type === 'sold_out') {
      return {
        text: isThailand ? 'ขายหมดแล้ว' : isChinese ? '已售罄' : 'Sold Out',
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        icon: null,
      };
    }

    if (!isDayOpenForOrdering(day)) {
      return {
        text: isThailand ? 'ปิดรับออเดอร์แล้ว' : isChinese ? '此取货时段已截止' : 'Closed for this pickup',
        color: 'bg-red-50 text-red-600 border-red-200',
        icon: 'alert',
      };
    }

    if (todayName === day.cutoff_day) {
      return {
        text: isThailand
          ? `ปิดวันนี้ ${day.cutoff_time} น.`
          : isChinese
            ? `今日 ${day.cutoff_time} 截止`
            : `Closes today at ${day.cutoff_time}`,
        color: 'bg-amber-100 text-amber-700 border-amber-300',
        icon: 'clock',
      };
    }

    return {
      text: isThailand ? 'เปิดรับออเดอร์' : isChinese ? '接受订单中' : 'Open',
      color: 'bg-green-100 text-green-700 border-green-300',
      icon: null,
    };
  };

  return (
    <div className="w-full">
      <p className="text-sm text-gray-600 mb-4 text-center">
        {isThailand
          ? 'สั่งสินค้าภายในเวลาปิดรับออเดอร์ของแต่ละรอบ'
          : isChinese
            ? '请在各时段截止时间前下单。'
            : 'Place your order before the respective cut-off times (see Products page).'}
      </p>

      <div className="space-y-3">
        {pickupDays.map((day) => {
          const rule = day.cutoff_rule;
          const label = isThailand
            ? (day.label_th || day.label_en || day.label)
            : isChinese
              ? (day.label_zh || day.label_en || day.label)
              : (day.label_en || day.label);
          const status = getStatusBadge(day);
          const cutoffDayZh = rule?.cutoff_day_zh || day.cutoff_day;
          const note = isThailand
            ? day.override?.note_th
            : isChinese
              ? (day.override?.note_zh || day.override?.note_en)
              : day.override?.note_en;

          return (
            <div
              key={day.id}
              className="bg-white border-2 border-amber-100 rounded-xl p-4 hover:border-amber-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm md:text-base mb-1">
                    {label}
                  </p>
                  <p className="text-xs md:text-sm text-gray-600">
                    {isThailand
                      ? `สั่งก่อน ${day.cutoff_day} เวลา ${day.cutoff_time} น.`
                      : isChinese
                        ? `截止时间：${cutoffDayZh} ${day.cutoff_time}`
                        : `Order by ${day.cutoff_day} ${day.cutoff_time}`}
                  </p>
                </div>

                <div className={`px-3 py-1.5 rounded-lg border-2 font-medium text-xs md:text-sm whitespace-nowrap flex items-center gap-1.5 ${status.color}`}>
                  {status.icon === 'clock' && <Clock className="w-4 h-4" />}
                  {status.icon === 'alert' && <AlertCircle className="w-4 h-4" />}
                  {status.text}
                </div>
              </div>

              {note && (
                <p className="text-xs text-orange-600 mt-2">
                  {note}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
