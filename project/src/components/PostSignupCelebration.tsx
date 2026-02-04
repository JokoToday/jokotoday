import React, { useRef, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';

interface PostSignupCelebrationProps {
  qrToken: string;
  qrValue: string;
  onClose: () => void;
  onGoToProfile: () => void;
  shortCode?: string;
}

export function PostSignupCelebration({
  qrToken,
  qrValue,
  onClose,
  onGoToProfile,
  shortCode
}: PostSignupCelebrationProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setShowContent(true);
  }, []);

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
      const urlObj = URL.createObjectURL(svgBlob);

      image.onload = () => {
        if (ctx) {
          ctx.scale(2, 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, rect.width + margin * 2, rect.height + margin * 2);
          ctx.drawImage(image, margin, margin);
        }
        URL.revokeObjectURL(urlObj);

        const safeValue = String(shortCode || qrValue || qrToken).trim().replace(/[^a-zA-Z0-9]/g, '');
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `joko-qr-${safeValue}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      image.src = urlObj;
    }
  };

  const steps = [
    {
      en: 'Save this QR on your phone',
      th: 'บันทึก QR นี้ไว้ในโทรศัพท์',
      icon: '📱'
    },
    {
      en: 'Show it at pickup',
      th: 'แสดงตอนมารับสินค้า',
      icon: '✨'
    },
    {
      en: 'Enjoy your goodies',
      th: 'อร่อยได้เลย',
      icon: '🥐'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <style>{`
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .sparkle-animation {
          animation: sparkle 2s ease-in-out infinite;
        }
        .float-animation {
          animation: float 3s ease-in-out infinite;
        }
        .fade-in-scale {
          animation: fadeInScale 0.6s ease-out forwards;
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full">
        <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-6 sm:p-8">
          {/* Celebration Header */}
          <div className={`text-center mb-8 ${showContent ? 'fade-in-scale' : 'opacity-0'}`}>
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 shadow-lg float-animation">
              <span className="text-4xl">🎉</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {getLabel('celebration.welcome_header', language,
                language === 'th' ? 'ยินดีต้อนรับสู่ JOKO TODAY!' : 'Welcome to JOKO TODAY!'
              )}
            </h1>
            <p className="text-gray-700 font-medium mb-1">
              {getLabel('celebration.qr_ready', language,
                language === 'th' ? 'QR Code ส่วนตัวของคุณพร้อมใช้งานแล้ว' : 'Your personal QR code is ready.'
              )}
            </p>
            <p className="text-sm text-gray-600">
              {getLabel('celebration.qr_description', language,
                language === 'th' ? 'ใช้สำหรับเข้าสู่ระบบและรับสินค้าได้อย่างรวดเร็ว' : 'This is your fast pass for easy pickup & login.'
              )}
            </p>
          </div>

          {/* QR Code */}
          <div className={`bg-white p-6 rounded-xl shadow-md flex flex-col items-center mb-8 ${showContent ? 'fade-in-scale' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
            <div ref={qrRef} className="bg-white p-4 rounded-xl mb-2">
              <QRCodeSVG
                value={String(qrValue).trim()}
                size={180}
                level="M"
                includeMargin={true}
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ID: {qrToken.slice(0, 8)}...
            </p>

            {shortCode && (
              <div className="mt-4 pt-4 border-t border-gray-200 w-full text-center">
                <p className="text-xs text-gray-600 mb-1">
                  {language === 'en' ? 'Your Member Code' : 'รหัสสมาชิกของคุณ'}
                </p>
                <p className="text-2xl font-bold text-amber-600 font-mono">
                  {shortCode}
                </p>
              </div>
            )}
          </div>

          {/* Steps Guide */}
          <div className={`space-y-3 mb-8 ${showContent ? 'fade-in-scale' : 'opacity-0'}`} style={{ animationDelay: '0.4s' }}>
            <h3 className="font-semibold text-gray-900 text-sm pl-1">
              {getLabel('celebration.steps_title', language,
                language === 'th' ? '3 ขั้นตอนง่ายๆ' : '3 Easy Steps'
              )}
            </h3>
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-white bg-opacity-60 p-3 rounded-lg border border-amber-100">
                <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center font-bold text-amber-700 text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {step.icon} {language === 'th' ? step.th : step.en}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className={`p-6 sm:p-8 bg-gray-50 space-y-3 ${showContent ? 'fade-in-scale' : 'opacity-0'}`} style={{ animationDelay: '0.6s' }}>
          <button
            onClick={handleSaveToPhone}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <Download className="w-5 h-5" />
            <span>
              {getLabel('celebration.save_qr_button', language,
                language === 'th' ? 'บันทึก QR ลงมือถือ' : 'Save QR to Phone'
              )}
            </span>
          </button>

          <button
            onClick={onGoToProfile}
            className="w-full bg-white hover:bg-gray-100 text-amber-600 font-semibold py-3 rounded-lg transition-colors border border-amber-200 flex items-center justify-center gap-2"
          >
            <span>
              {getLabel('celebration.go_profile_button', language,
                language === 'th' ? 'ไปที่โปรไฟล์ของฉัน' : 'Go to My Profile'
              )}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full text-gray-600 hover:text-gray-900 font-medium py-2 transition-colors text-sm"
          >
            {getLabel('celebration.dismiss_button', language,
              language === 'th' ? 'ปิด' : 'Dismiss'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
