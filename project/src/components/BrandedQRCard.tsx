import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import jsPDF from 'jspdf';

interface BrandedQRCardProps {
  qrToken: string;
  qrValue: string;
  customerName: string;
  shortCode?: string;
}

export function BrandedQRCard({ qrToken, qrValue, customerName, shortCode }: BrandedQRCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();

  const BakeryPattern = () => (
    <svg className="absolute inset-0 w-full h-full opacity-8 pointer-events-none" preserveAspectRatio="none">
      <defs>
        <pattern id="bakeryPattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
          <g stroke="#D97706" strokeWidth="0.3" fill="none" opacity="0.4">
            <path d="M20,20 Q30,15 40,20 Q35,25 40,30 Q30,35 20,30 Q25,25 20,20" />
            <path d="M70,30 L75,35 L70,40 L65,35 Z" />
            <path d="M30,60 L60,60 L55,80 L35,80 Z" />
            <path d="M80,70 Q85,65 90,70 Q85,75 80,70" />
            <line x1="20" y1="50" x2="40" y2="50" />
            <line x1="45" y1="50" x2="55" y2="45" />
            <line x1="60" y1="50" x2="75" y2="55" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bakeryPattern)" />
    </svg>
  );

  const handleDownloadCard = async () => {
    try {
      const svg = qrRef.current?.querySelector('svg') as SVGSVGElement;
      if (!svg) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const rect = svg.getBoundingClientRect();
        const margin = 32;
        canvas.width = (rect.width + margin * 2) * 2;
        canvas.height = (rect.height + margin * 2) * 2;

        if (ctx) {
          ctx.scale(2, 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, rect.width + margin * 2, rect.height + margin * 2);
          ctx.drawImage(img, margin, margin);
        }

        const qrImageData = canvas.toDataURL('image/png');

        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [85, 55],
        });

        const pageWidth = 85;
        const pageHeight = 55;

        pdf.setFillColor(251, 248, 243);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');

        pdf.setTextColor(120, 80, 20);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text('JOKO TODAY', pageWidth / 2, 8, { align: 'center' });

        const qrSize = 25;
        const qrX = (pageWidth - qrSize) / 2;
        const qrY = (pageHeight - qrSize) / 2 - 1;

        pdf.addImage(qrImageData, 'PNG', qrX, qrY, qrSize, qrSize);

        const cleanName = String(customerName || '').trim().slice(0, 20);
        pdf.setTextColor(80, 60, 40);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text(cleanName, pageWidth / 2, pageHeight - 12, {
          align: 'center',
        });

        if (shortCode) {
          const cleanShortCode = String(shortCode).trim();
          pdf.setTextColor(180, 100, 40);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(cleanShortCode, pageWidth / 2, pageHeight - 7, { align: 'center' });
        }

        URL.revokeObjectURL(svgUrl);

        const safeFileName = String(shortCode || 'card').trim().replace(/[^a-zA-Z0-9]/g, '');
        pdf.save(`joko-qr-${safeFileName}.pdf`);
      };

      img.src = svgUrl;
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleDownloadImage = async () => {
    const svg = qrRef.current?.querySelector('svg') as SVGSVGElement;
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const rect = svg.getBoundingClientRect();
    const margin = 32;

    canvas.width = (rect.width + margin * 2) * 2;
    canvas.height = (rect.height + margin * 2) * 2;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      if (ctx) {
        ctx.scale(2, 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, rect.width + margin * 2, rect.height + margin * 2);
        ctx.drawImage(image, margin, margin);
      }
      URL.revokeObjectURL(url);

      const safeFileName = String(shortCode || 'card').trim().replace(/[^a-zA-Z0-9]/g, '');
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `joko-qr-${safeFileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    image.src = url;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-8">
        <div
          ref={cardRef}
          className="relative w-96 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-3xl shadow-2xl px-8 py-6 border-2 border-amber-200 overflow-hidden flex flex-col items-center justify-center"
          style={{
            aspectRatio: '1.55 / 1',
            transformOrigin: 'center',
          }}
        >
          <BakeryPattern />

          <div className="absolute inset-0 opacity-3 pointer-events-none">
            <div className="absolute top-3 right-6 w-20 h-20 bg-yellow-200 rounded-full blur-3xl"></div>
            <div className="absolute bottom-3 left-6 w-16 h-16 bg-orange-200 rounded-full blur-3xl"></div>
          </div>

          <div className="relative flex flex-col items-center justify-center gap-4 w-full h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-amber-950 tracking-tight">JOKO TODAY</h2>
            </div>

            <div ref={qrRef} className="bg-white p-4 rounded-xl flex items-center justify-center flex-shrink-0">
              <QRCodeSVG
                value={String(qrValue).trim()}
                size={110}
                level="M"
                includeMargin={true}
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            </div>

            <div className="text-center space-y-1 flex-shrink-0">
              <p className="text-lg font-bold text-amber-950 truncate w-56">
                {customerName}
              </p>
              {shortCode && (
                <p className="text-lg font-bold text-amber-700 tracking-wide font-mono">
                  {shortCode} 🥐
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleDownloadCard}
          className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md"
        >
          <Download className="w-5 h-5" />
          {getLabel('qr_page.download_card_button', language,
            language === 'th' ? 'ดาวน์โหลดเป็นบัตร' : 'Download as Card'
          )}
        </button>

        <button
          onClick={handleDownloadImage}
          className="w-full bg-white hover:bg-gray-50 text-amber-600 font-semibold py-3 rounded-lg transition-all border border-amber-200 flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          {getLabel('qr_page.download_image_button', language,
            language === 'th' ? 'ดาวน์โหลดเป็นรูปภาพ' : 'Download as Image'
          )}
        </button>
      </div>

      <p className="text-xs text-gray-600 text-center">
        {getLabel('qr_page.card_info', language,
          language === 'th' ? 'บันทึกไว้ในโทรศัพท์หรือพิมพ์ไว้ในกระเป๋าสตางค์ของคุณ' : 'You can save it to your phone or print it as a small card for your wallet.'
        )}
      </p>
    </div>
  );
}
