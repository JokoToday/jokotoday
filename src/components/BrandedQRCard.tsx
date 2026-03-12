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

  const svgToDataUrl = (svg: SVGSVGElement): Promise<string> => {
    return new Promise((resolve, reject) => {
      const size = 200;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));

      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };
      img.src = url;
    });
  };

  const handleDownloadCard = async () => {
    try {
      const svg = qrRef.current?.querySelector('svg') as SVGSVGElement;
      if (!svg) return;

      const qrImageData = await svgToDataUrl(svg);

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

      const qrSize = 28;
      const qrX = (pageWidth - qrSize) / 2;
      const qrY = 12;

      pdf.addImage(qrImageData, 'PNG', qrX, qrY, qrSize, qrSize);

      const cleanName = String(customerName || '').trim().slice(0, 24);
      pdf.setTextColor(80, 60, 40);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text(cleanName, pageWidth / 2, pageHeight - 9, { align: 'center' });

      if (shortCode) {
        const cleanShortCode = String(shortCode).trim();
        pdf.setTextColor(180, 100, 40);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(cleanShortCode, pageWidth / 2, pageHeight - 4, { align: 'center' });
      }

      const safeFileName = String(shortCode || 'card').trim().replace(/[^a-zA-Z0-9]/g, '');
      pdf.save(`joko-qr-${safeFileName}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleDownloadImage = async () => {
    try {
      const svg = qrRef.current?.querySelector('svg') as SVGSVGElement;
      if (!svg) return;

      const dataUrl = await svgToDataUrl(svg);
      const safeFileName = String(shortCode || 'card').trim().replace(/[^a-zA-Z0-9]/g, '');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `joko-qr-${safeFileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating image:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-6">
        <div
          ref={cardRef}
          className="relative w-full max-w-md bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-2xl shadow-2xl border-2 border-amber-200 overflow-hidden flex flex-col items-center justify-center text-center px-6 py-4"
          style={{ aspectRatio: '1.586 / 1' }}
        >
          <BakeryPattern />

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-3 right-6 w-20 h-20 bg-yellow-200 rounded-full blur-3xl opacity-30"></div>
            <div className="absolute bottom-3 left-6 w-16 h-16 bg-orange-200 rounded-full blur-3xl opacity-30"></div>
          </div>

          <div className="relative flex flex-row items-center justify-center gap-5 w-full h-full">
            <div ref={qrRef} className="bg-white p-2 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              <QRCodeSVG
                value={String(qrValue).trim()}
                size={100}
                level="M"
                includeMargin={false}
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            </div>

            <div className="flex flex-col items-start justify-center text-left gap-1 min-w-0 flex-1">
              <h2 className="text-sm font-bold text-amber-800 tracking-widest uppercase">JOKO TODAY</h2>
              <p className="text-base font-semibold text-amber-950 break-words leading-snug w-full">
                {customerName}
              </p>
              {shortCode && (
                <p className="text-xs font-bold text-amber-700 tracking-wide font-mono opacity-80">
                  {shortCode}
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
