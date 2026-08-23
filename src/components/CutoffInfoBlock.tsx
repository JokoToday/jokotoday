import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { getPickupDays, PickupDay } from '../lib/availabilityService';
import { CountdownTimer } from './CountdownTimer';

interface CutoffInfoBlockProps {
  language: 'en' | 'th';
}

export function CutoffInfoBlock({ language }: CutoffInfoBlockProps) {
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPickupDays()
      .then((days) => setPickupDays(days))
      .finally(() => setLoading(false));
  }, []);

  const visibleDays = pickupDays.filter((day) =>
    day.cutoff_rule
    && day.override?.override_type !== 'closed'
    && day.override?.override_type !== 'sold_out'
  );

  if (loading || visibleDays.length === 0) {
    return null;
  }

  const isThailand = language === 'th';
  const title = isThailand
    ? '🕒 เวลาปิดรับออเดอร์ล่วงหน้า'
    : '🕒 Pre-Order Cut-Off Times';
  const subtitle = isThailand
    ? 'กรุณาสั่งก่อนเวลาที่กำหนดสำหรับแต่ละวันรับสินค้า:'
    : 'Please place your order before the respective cut-off time:';

  return (
    <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border border-orange-200 rounded-xl p-6 mb-6 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <Clock className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-700 mt-1">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-3 ml-8">
        {visibleDays.map((day) => {
          const label = isThailand
            ? (day.label_th || day.label_en || day.label)
            : (day.label_en || day.label);

          return (
            <div key={day.id} className="bg-white rounded-lg p-3 border border-orange-100">
              <p className="font-medium text-gray-900 text-sm mb-1">{label}</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-600">
                  {isThailand
                    ? `สั่งก่อน ${day.cutoff_day} เวลา ${day.cutoff_time} น.`
                    : `Order by ${day.cutoff_day} ${day.cutoff_time}`}
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
    </div>
  );
}
