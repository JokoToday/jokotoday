import React, { useEffect, useState } from 'react';
import { getCutoffRules, CutoffRule, getPickupOverrides, PickupOverride, getOverrideForDate } from '../lib/availabilityService';

interface CutoffRulesSelectorProps {
  language: 'en' | 'th';
}

export function CutoffRulesSelector({ language }: CutoffRulesSelectorProps) {
  const [rules, setRules] = useState<CutoffRule[]>([]);
  const [overrides, setOverrides] = useState<PickupOverride[]>([]);
  const [selectedRule, setSelectedRule] = useState<CutoffRule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [rulesData, overridesData] = await Promise.all([
        getCutoffRules(),
        getPickupOverrides(),
      ]);
      setRules(rulesData);
      setOverrides(overridesData);
      if (rulesData.length > 0) {
        setSelectedRule(rulesData[0]);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading || rules.length === 0) {
    return null;
  }

  const isThailand = language === 'th';
  const title = isThailand
    ? 'เวลาปิดรับออเดอร์ล่วงหน้า'
    : 'Pre-Order Cut-Off Times';

  const subtitle = isThailand
    ? 'กรุณาสั่งก่อนเวลาปิดรับออเดอร์ของแต่ละรอบ เลือกสถานที่รับสินค้าเพื่อดูวันและเวลาปิดรับออเดอร์:'
    : 'Place your order before the respective cut-off time. Choose your pickup location below to see the cut-off day & time:';

  return (
    <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border border-orange-200 rounded-xl p-6 text-gray-700">
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm mb-4">{subtitle}</p>

      <div className="space-y-4">
        <select
          value={selectedRule?.id || ''}
          onChange={(e) => {
            const rule = rules.find((r) => r.id === e.target.value);
            setSelectedRule(rule || null);
          }}
          className="w-full px-4 py-2.5 border-2 border-orange-300 rounded-lg bg-white text-gray-900 font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
        >
          {rules.map((rule) => {
            const label = isThailand ? rule.pickup_label_th : rule.pickup_label_en;
            return (
              <option key={rule.id} value={rule.id}>
                {label}
              </option>
            );
          })}
        </select>

        {selectedRule && (
          <div className="bg-white rounded-lg p-4 border border-orange-100">
            <div className="text-center">
              {(() => {
                const today = new Date();
                const override = getOverrideForDate(overrides, today, selectedRule.pickup_day, selectedRule.location);

                if (override?.override_type === 'closed') {
                  return (
                    <p className="text-red-600 font-medium">
                      {isThailand ? 'ไม่เปิดรับออเดอร์ (วันหยุด)' : 'Not Available (Holiday)'}
                    </p>
                  );
                }

                if (override?.override_type === 'sold_out') {
                  return (
                    <p className="text-gray-600 font-medium">
                      {isThailand ? 'สินค้าหมดแล้ว' : 'Sold Out for This Day'}
                    </p>
                  );
                }

                const cutoffDay = override?.override_type === 'custom_cutoff' && override.custom_cutoff_day
                  ? override.custom_cutoff_day
                  : selectedRule.cutoff_day;

                const cutoffTime = override?.override_type === 'custom_cutoff' && override.custom_cutoff_time
                  ? override.custom_cutoff_time
                  : selectedRule.cutoff_time;

                return (
                  <>
                    <p className="text-sm text-gray-600 mb-2">
                      {isThailand ? 'เวลาปิดรับออเดอร์:' : 'Cut-off:'}
                    </p>
                    <p className="text-lg font-semibold text-orange-700">
                      {cutoffDay} {cutoffTime}
                      {isThailand ? ' น.' : ' PM'}
                    </p>
                    {override?.note_en && (
                      <p className="text-xs text-orange-600 mt-2">
                        {isThailand ? override.note_th : override.note_en}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
