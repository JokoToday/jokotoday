import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { getCutoffRules, CutoffRule, getPickupOverrides, PickupOverride, getOverrideForDate } from '../lib/availabilityService';
import { CountdownTimer } from './CountdownTimer';

interface CutoffInfoBlockProps {
  language: 'en' | 'th';
}

export function CutoffInfoBlock({ language }: CutoffInfoBlockProps) {
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

  const isThailand = language === 'th';
  const title = isThailand
    ? '🕒 เวลาปิดรับออเดอร์ล่วงหน้า'
    : '🕒 Pre-Order Cut-Off Times';

  const subtitle = isThailand
    ? 'กรุณาสั่งก่อนเวลาที่กำหนดสำหรับแต่ละวันรับสินค้า:'
    : 'Please place your order before the respective cut-off time:';

  const today = new Date();

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
        {rules.map((rule) => {
          const label = isThailand ? rule.pickup_label_th : rule.pickup_label_en;
          const override = getOverrideForDate(overrides, today, rule.pickup_day, rule.location);

          if (override && override.override_type === 'closed') {
            return null;
          }

          const cutoffDay = override?.override_type === 'custom_cutoff' && override.custom_cutoff_day
            ? override.custom_cutoff_day
            : rule.cutoff_day;

          const cutoffTime = override?.override_type === 'custom_cutoff' && override.custom_cutoff_time
            ? override.custom_cutoff_time
            : rule.cutoff_time;

          return (
            <div key={rule.id} className="bg-white rounded-lg p-3 border border-orange-100">
              <p className="font-medium text-gray-900 text-sm mb-1">{label}</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-600">
                  {isThailand
                    ? ` สั่งก่อน ${cutoffDay} เวลา ${cutoffTime} น.`
                    : ` Order by ${cutoffDay} ${cutoffTime} PM`}
                </p>
                <CountdownTimer
                  cutoffDay={cutoffDay}
                  cutoffTime={cutoffTime}
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
