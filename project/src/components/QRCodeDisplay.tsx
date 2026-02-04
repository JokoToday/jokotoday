import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';

interface QRCodeDisplayProps {
  qrToken: string;
  qrValue: string;
  onClose?: () => void;
}

export function QRCodeDisplay({ qrToken, qrValue, onClose }: QRCodeDisplayProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();

  const handleSaveToPhone = () => {
    const svg = qrRef.current?.querySelector('svg') as SVGSVGElement;
    if (svg) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const rect = svg.getBoundingClientRect();
      const margin = 32;

      canvas.width = (rect.width + margin * 2) * 2;
      canvas.height = (rect.height + margin * 2) * 2;

      const image = new Image();
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);

      image.onload = () => {
        if (ctx) {
          ctx.scale(2, 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, rect.width + margin * 2, rect.height + margin * 2);
          ctx.drawImage(image, margin, margin);
        }
        URL.revokeObjectURL(url);

        const safeValue = String(qrValue || qrToken).trim().replace(/[^a-zA-Z0-9]/g, '');
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `joko-qr-${safeValue}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      image.src = url;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <Sparkles className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">
          {getLabel('qr.success_header', language, "You're all set!")}
        </h3>
        <p className="text-gray-600">
          {getLabel('qr.loyalty_card_title', language, 'Your Personal Loyalty Card')}
        </p>
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-200 flex flex-col items-center">
        <div
          ref={qrRef}
          className="bg-white p-4 rounded-xl shadow-sm"
        >
          <QRCodeSVG
            value={String(qrValue).trim()}
            size={200}
            level="M"
            includeMargin={true}
            fgColor="#000000"
            bgColor="#FFFFFF"
          />
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          ID: {qrToken.slice(0, 8)}...
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3 text-sm">
          {getLabel('qr.what_is_this', language, "What's this QR code for?")}
        </h4>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {getLabel('qr.benefit_1_title', language, '📦 Easy pickup')}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {getLabel('qr.benefit_1_text', language, "Show this when picking up your order—no need to remember order numbers!")}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {getLabel('qr.benefit_2_title', language, '⭐ Loyalty rewards')}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {getLabel('qr.benefit_2_text', language, "We'll scan it each visit to track your rewards and special offers")}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {getLabel('qr.benefit_3_title', language, '💝 Personal touch')}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {getLabel('qr.benefit_3_text', language, 'Helps us remember your favorites and surprise you with treats!')}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleSaveToPhone}
          className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          {getLabel('qr.save_button', language, 'Save to Photos')}
        </button>
        <p className="text-xs text-gray-500 text-center">
          {getLabel('qr.view_anytime', language, 'You can view it anytime in your account')}
        </p>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="w-full text-amber-600 hover:text-amber-700 font-semibold py-2 transition-colors"
        >
          {getLabel('qr.done_button', language, "Got it! Let's shop")}
        </button>
      )}
    </div>
  );
}
