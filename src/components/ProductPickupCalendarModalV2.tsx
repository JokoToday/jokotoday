import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { CMSProduct } from '../lib/cmsService';
import {
  readPreferredPickupDateV2,
  writePreferredPickupDateV2,
} from '../lib/pickupV2PreferredSelection';
import { PickupDateSelectorV2, PickupSelectionV2 } from './PickupDateSelectorV2';

interface ProductPickupCalendarModalV2Props {
  product: CMSProduct | null;
  quantity: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductPickupCalendarModalV2({
  product,
  quantity,
  isOpen,
  onClose,
}: ProductPickupCalendarModalV2Props) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [selection, setSelection] = useState<PickupSelectionV2 | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const preferred = readPreferredPickupDateV2(user?.id ?? null);
    if (preferred?.pickupLocationId) {
      setSelection({
        pickupDateId: preferred.pickupDateId,
        pickupDate: preferred.pickupDate,
        pickupLocationId: preferred.pickupLocationId,
        scheduleId: preferred.scheduleId,
        scheduleKey: preferred.scheduleKey,
      });
    } else {
      setSelection(null);
    }
  }, [isOpen, product?.id, user?.id]);

  if (!isOpen || !product) return null;

  const name = language === 'th'
    ? product.name_th
    : language === 'zh'
      ? product.name_zh || product.name_en
      : product.name_en;
  const title = language === 'th'
    ? `วันรับสินค้า: ${name}`
    : language === 'zh'
      ? `${name} 的取货日期`
      : `Pickup dates for ${name}`;
  const helper = language === 'th'
    ? `ดูวันและสถานที่รับสินค้าสำหรับ ${name} จำนวน ${quantity} ชิ้น`
    : language === 'zh'
      ? `查看 ${quantity} 件 ${name} 可选择的取货日期和地点。`
      : `See pickup dates and locations available for your current quantity of ${quantity}.`;
  const usePickupLabel = language === 'th'
    ? 'ใช้การรับสินค้านี้'
    : language === 'zh'
      ? '使用此取货安排'
      : 'Use this pickup';

  const confirmPickup = () => {
    if (!selection) return;
    writePreferredPickupDateV2(user?.id ?? null, {
      pickupDateId: selection.pickupDateId,
      pickupDate: selection.pickupDate,
      pickupLocationId: selection.pickupLocationId,
      scheduleId: selection.scheduleId,
      scheduleKey: selection.scheduleKey,
      scheduleLabelEn: selection.scheduleKey,
      scheduleLabelTh: null,
      scheduleLabelZh: null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto px-4 py-8">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 sm:px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500 mt-1">{helper}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-4 sm:px-6 pt-5">
          <PickupDateSelectorV2
            requirements={[{
              productId: product.id,
              quantity,
              nameEn: product.name_en,
              nameTh: product.name_th,
              nameZh: product.name_zh || null,
            }]}
            value={selection}
            onChange={setSelection}
          />
        </div>

        <div className="sticky bottom-0 border-t border-gray-100 bg-white/95 backdrop-blur px-5 sm:px-6 py-4">
          <button
            type="button"
            onClick={confirmPickup}
            disabled={!selection}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-5 h-5" />
            {usePickupLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
