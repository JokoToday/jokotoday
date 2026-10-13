import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { RegularPickupDeskPage } from './RegularPickupDeskPage';
import { SpecialsPickupDeskPage } from './SpecialsPickupDeskPage';

export function PickupDeskPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { language } = useLanguage();
  const [specials, setSpecials] = useState(false);
  return <>
    <nav aria-label={language === 'th' ? 'ประเภทการรับสินค้า' : 'Pickup order type'} className="flex justify-center gap-3 bg-[#FBF7EE] p-3">
      <button type="button" aria-pressed={!specials} onClick={() => setSpecials(false)} className="min-h-11 rounded-lg border border-[#55766F] px-5 text-[#303532]">{language === 'th' ? 'พรีออร์เดอร์' : 'Preorders'}</button>
      <button type="button" aria-pressed={specials} onClick={() => setSpecials(true)} className="min-h-11 rounded-lg border border-[#55766F] px-5 text-[#303532]">JOKO Specials</button>
    </nav>
    {specials ? <SpecialsPickupDeskPage onNavigate={onNavigate} /> : <RegularPickupDeskPage onNavigate={onNavigate} />}
  </>;
}
