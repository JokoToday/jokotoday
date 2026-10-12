import { Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePublishedJokoLogo } from '../../app/joko-today/builder/usePublishedJokoLogo';
import { printOrderDocument, type PrintOrderLanguage } from '../../lib/printOrderDocument';
import type { OrderReceiptRecord } from '../../lib/receiptService';

const FALLBACK = {
  en: 'View / print receipt',
  th: 'ดู / พิมพ์ใบเสร็จ',
  zh: '查看 / 打印收据',
} as const;

export function PrintReceiptButton({
  receipt,
  language,
  className = '',
  fullWidth = false,
}: {
  receipt: OrderReceiptRecord;
  language: PrintOrderLanguage;
  className?: string;
  fullWidth?: boolean;
}) {
  const publishedLogoUrl = usePublishedJokoLogo();

  const handlePrint = () => {
    const snapshot = receipt.snapshot;
    const rawNextOrderUrl = snapshot.next_order_url || '/products?from=receipt';
    const nextOrderUrl = new URL(rawNextOrderUrl, window.location.origin).href;
    const footerQrLabels = {
      en: snapshot.copy_by_language?.en?.nextOrder || 'Your next order',
      th: snapshot.copy_by_language?.th?.nextOrder || 'สั่งครั้งถัดไป',
      zh: snapshot.copy_by_language?.zh?.nextOrder || '再次订购',
    };
    const qrSvg = renderToStaticMarkup(
      <QRCodeSVG
        value={nextOrderUrl}
        size={144}
        level="M"
        marginSize={2}
        aria-label={footerQrLabels[language]}
      />,
    );

    printOrderDocument({
      order: snapshot.order,
      language,
      logoUrl: publishedLogoUrl,
      documentType: 'receipt',
      pickupLabels: snapshot.pickup_labels,
      pickupLocationNames: snapshot.pickup_location_names,
      statusLabels: snapshot.status_labels,
      paymentDescriptions: snapshot.payment_descriptions,
      copyByLanguage: snapshot.copy_by_language,
      receiptNumber: snapshot.receipt_number || receipt.receipt_number,
      issuedAt: snapshot.issued_at || receipt.issued_at,
      customerReceivedAt: snapshot.customer_received_at,
      footerQrSvg: qrSvg,
      footerQrLabels,
      footerQrText: nextOrderUrl,
    });
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl border border-[#55766F]/20 bg-[#CFE3DF]/55 px-3.5 py-2 text-xs font-semibold text-[#304B45] transition hover:bg-[#CFE3DF]',
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      <Printer className="h-4 w-4" />
      {FALLBACK[language]}
    </button>
  );
}
