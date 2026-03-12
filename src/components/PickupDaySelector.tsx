import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { getCutoffRules, getPickupOverrides, getOverrideForDate, CutoffRule, PickupOverride } from '../lib/availabilityService';
import { CountdownTimer } from './CountdownTimer';
import { useLanguage } from '../context/LanguageContext';

interface PickupDaySelectorProps {
  selectedPickupDay: string | null;
  onPickupDayChange: (day: string | null) => void;
  availableDays: string[];
  closedDays: string[];
}

export function PickupDaySelector({
  selectedPickupDay,
  onPickupDayChange,
  availableDays,
  closedDays,
}: PickupDaySelectorProps) {
  const { t, language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
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

  const today = new Date();

  const dayOptions = [
    { value: 'Friday – Mae Rim', labelEn: 'Friday – Mae Rim', labelTh: 'วันศุกร์ – แม่ริม', labelZh: '周五 – 湄林' },
    { value: 'Saturday – Mae Rim', labelEn: 'Saturday – Mae Rim', labelTh: 'วันเสาร์ – แม่ริม', labelZh: '周六 – 湄林' },
    { value: 'Sunday – In-Town', labelEn: 'Sunday – In-Town', labelTh: 'วันอาทิตย์ – ในเมือง', labelZh: '周日 – 市区' },
  ];

  const getDisplayLabel = (option: typeof dayOptions[0]) => {
    if (language === 'th') return option.labelTh;
    if (language === 'zh') return option.labelZh;
    return option.labelEn;
  };

  const headerTextEn = 'Orders close before baking starts';
  const headerTextTh = 'ปิดรับออเดอร์ก่อนเริ่มอบ';
  const headerTextZh = '烘焙开始前截止接单';
  const selectLabelEn = 'Select your pickup day:';
  const selectLabelTh = 'เลือกวันรับสินค้า:';
  const selectLabelZh = '请选择取货日期：';

  return (
    <div className="max-w-2xl mx-auto mb-8">
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-2 border-amber-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-gray-700">
          <Clock className="w-5 h-5 text-amber-600" />
          <p className="text-sm font-medium">
            {language === 'th' ? headerTextTh : language === 'zh' ? headerTextZh : headerTextEn}
          </p>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
            <span className="text-lg">📅</span>
            <span>{language === 'th' ? selectLabelTh : language === 'zh' ? selectLabelZh : selectLabelEn}</span>
          </label>
          <select
            value={selectedPickupDay || ''}
            onChange={(e) => onPickupDayChange(e.target.value || null)}
            className="w-full px-4 py-3 border-2 border-amber-300 rounded-xl bg-white text-gray-900 font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:border-amber-400"
          >
            <option value="">{t.pickupDay.chooseDayPlaceholder}</option>
            {dayOptions.map((option) => {
              const isClosed = closedDays.includes(option.value);
              const isSoldOut = !availableDays.includes(option.value) && !isClosed;

              return (
                <option key={option.value} value={option.value} disabled={isClosed}>
                  {getDisplayLabel(option)}
                  {isClosed ? ` (${t.pickupDay.preordersClosed})` : ''}
                  {isSoldOut ? ` (${t.product.soldOut})` : ''}
                </option>
              );
            })}
          </select>
        </div>

        {!loading && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors group"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 group-hover:transform group-hover:-translate-y-0.5 transition-transform" />
            ) : (
              <ChevronDown className="w-4 h-4 group-hover:transform group-hover:translate-y-0.5 transition-transform" />
            )}
            <span>
              {language === 'th' ? 'ดูเวลาปิดรับออเดอร์' : language === 'zh' ? '查看截止时间' : 'View cutoff times'}
            </span>
          </button>
        )}

        {isExpanded && !loading && (
          <div className="mt-4 space-y-3 animate-fadeIn">
            {rules.map((rule) => {
              const label = language === 'th'
                ? rule.pickup_label_th
                : language === 'zh'
                ? (rule.pickup_label_zh || rule.pickup_label_en)
                : rule.pickup_label_en;
              const override = getOverrideForDate(overrides, today, rule.pickup_day, rule.location);

              if (override && override.override_type === 'closed') {
                return (
                  <div
                    key={rule.id}
                    className="bg-red-50 border-2 border-red-200 rounded-xl p-4 transition-all"
                  >
                    <p className="font-semibold text-gray-900 text-sm mb-1">{label}</p>
                    <p className="text-xs text-red-700 font-medium">
                      {language === 'th' ? 'ปิดรับออเดอร์' : language === 'zh' ? '此取货时段已截止' : 'Closed for this pickup'}
                    </p>
                  </div>
                );
              }

              const cutoffDay = override?.override_type === 'custom_cutoff' && override.custom_cutoff_day
                ? override.custom_cutoff_day
                : rule.cutoff_day;

              const cutoffTime = override?.override_type === 'custom_cutoff' && override.custom_cutoff_time
                ? override.custom_cutoff_time
                : rule.cutoff_time;

              const cutoffDayZh = rule.cutoff_day_zh || cutoffDay;

              return (
                <div
                  key={rule.id}
                  className="bg-white border-2 border-amber-100 rounded-xl p-4 hover:border-amber-200 transition-all shadow-sm"
                >
                  <p className="font-semibold text-gray-900 text-sm mb-2">{label}</p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-600">
                      {language === 'th'
                        ? `สั่งก่อน ${cutoffDay} เวลา ${cutoffTime} น.`
                        : language === 'zh'
                        ? `截止时间：${cutoffDayZh} ${cutoffTime}`
                        : `Order by ${cutoffDay} ${cutoffTime}`}
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
        )}

        {!selectedPickupDay && (
          <p className="text-center text-gray-600 text-sm mt-4 bg-white/50 rounded-lg p-3">
            {t.pickupDay.selectDayHelper}
          </p>
        )}

        {selectedPickupDay && closedDays.includes(selectedPickupDay) && (
          <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
            <p className="text-center text-red-700 text-sm font-semibold mb-1">
              {t.pickupDay.preordersClosedFull}
            </p>
            <p className="text-center text-red-600 text-xs">
              {t.pickupDay.chooseAnotherDay}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
