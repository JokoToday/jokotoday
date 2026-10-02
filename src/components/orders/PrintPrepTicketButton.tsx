import { Printer } from 'lucide-react';
import {
  printOrderDocument,
  type PrintableOrder,
  type PrintOrderLanguage,
} from '../../lib/printOrderDocument';

type Props = {
  order: PrintableOrder;
  customerName?: string | null;
  language: PrintOrderLanguage;
  logoUrl?: string | null;
  pickupLocationName?: string | null;
  pickupLocationNames?: Partial<Record<PrintOrderLanguage, string>>;
  className?: string;
};

const BUTTON_LABEL: Record<PrintOrderLanguage, string> = {
  en: 'Print Prep Ticket',
  th: 'พิมพ์ใบเตรียมสินค้า',
  zh: '打印备货单',
};

export function PrintPrepTicketButton({
  order,
  customerName,
  language,
  logoUrl,
  pickupLocationName,
  pickupLocationNames,
  className = '',
}: Props) {
  const handlePrint = () => {
    printOrderDocument({
      order,
      customerName,
      language,
      logoUrl,
      documentType: 'prep_ticket',
      pickupLocationName,
      pickupLocationNames,
    });
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 ${className}`}
    >
      <Printer className="h-4 w-4" />
      {BUTTON_LABEL[language]}
    </button>
  );
}
