import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import {
  DEFAULT_QR_PASS_CONFIG,
  getQrPassConfig,
  type QrPassConfig,
  type QrPassTextRoleStyle,
} from '../lib/qrPassConfig';
import {
  jokoChineseDisplayFontStack,
  jokoDisplayFontStack,
  jokoThaiDisplayFontStack,
} from '../platform/builder';
import jsPDF from 'jspdf';

interface BrandedQRCardProps {
  qrToken: string;
  qrValue: string;
  customerName: string;
  shortCode?: string;
  secondaryAction?: ReactNode;
  config?: QrPassConfig;
}

const CARD_WIDTH_MM = 55;
const CARD_HEIGHT_MM = 85;
const CARD_CANVAS_WIDTH = 660;
const CARD_CANVAS_HEIGHT = 1020;
const QR_FRAME_SIZE = 500;
const QR_MAX_SIZE = 420;

const QR_DOWNLOAD_BUTTON_CLASS =
  'w-full border border-amber-500 bg-white text-amber-700 font-semibold py-3 rounded-lg hover:border-amber-600 hover:bg-amber-600 hover:text-white hover:shadow-md focus-visible:border-amber-600 focus-visible:bg-amber-600 focus-visible:text-white focus-visible:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 transition-colors transition-shadow duration-200 flex items-center justify-center gap-2';

const THAI_TEXT = /[\u0E00-\u0E7F]/;
const HAN_TEXT = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

function fontStackForText(text: string, config: QrPassConfig): string {
  if (THAI_TEXT.test(text)) return jokoThaiDisplayFontStack(config.typography.thaiFont);
  if (HAN_TEXT.test(text)) return jokoChineseDisplayFontStack(config.typography.chineseFont);
  return jokoDisplayFontStack(config.typography.englishFont);
}

function textStyle(
  text: string,
  role: QrPassTextRoleStyle,
  config: QrPassConfig,
): CSSProperties {
  return {
    fontFamily: fontStackForText(text, config),
    fontWeight: role.weight,
    fontSize: role.size,
  };
}

export function BrandedQRCard({
  qrValue,
  customerName,
  shortCode,
  secondaryAction,
  config,
}: BrandedQRCardProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();
  const [savedConfig, setSavedConfig] = useState<QrPassConfig>(structuredClone(DEFAULT_QR_PASS_CONFIG));

  useEffect(() => {
    if (config) return;
    let cancelled = false;

    void getQrPassConfig().then((loadedConfig) => {
      if (!cancelled) setSavedConfig(loadedConfig);
    });

    return () => {
      cancelled = true;
    };
  }, [config]);

  const activeConfig = config || savedConfig;

  const roundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) => {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      // Canvas export needs CORS-safe pixels. The visible DOM preview deliberately
      // does not set crossOrigin; keeping these paths separate avoids a broken
      // preview while preserving export safety.
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      image.src = src;
    });
  };

  const drawContainedImage = (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    centerX: number,
    centerY: number,
    maxWidth: number,
    maxHeight: number,
  ) => {
    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
  };

  const svgToImage = (svg: SVGSVGElement, size: number): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('width', String(size));
      clone.setAttribute('height', String(size));

      const svgData = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load QR SVG'));
      };
      image.src = url;
    });
  };

  const setCanvasFont = async (
    ctx: CanvasRenderingContext2D,
    text: string,
    role: QrPassTextRoleStyle,
  ) => {
    const stack = fontStackForText(text, activeConfig);
    const font = `${role.weight} ${role.size}px ${stack}`;
    try {
      await document.fonts?.load(font, text);
    } catch {
      // The explicit stack still provides a deterministic fallback for canvas.
    }
    ctx.font = font;
  };

  const renderMemberCardCanvas = async () => {
    const svg = qrRef.current?.querySelector('svg') as SVGSVGElement | undefined;
    if (!svg) throw new Error('QR SVG not found');

    const viewBoxSize = Math.max(1, Math.round(svg.viewBox.baseVal.width));
    const moduleScale = Math.max(1, Math.floor(QR_MAX_SIZE / viewBoxSize));
    const qrSize = viewBoxSize * moduleScale;
    const [qrImage, logoImage] = await Promise.all([
      svgToImage(svg, qrSize),
      loadImage(activeConfig.logoUrl),
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = CARD_CANVAS_WIDTH;
    canvas.height = CARD_CANVAS_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas context');

    ctx.clearRect(0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT);
    ctx.fillStyle = activeConfig.cardBackground;
    ctx.fillRect(0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT);

    roundedRect(ctx, 18, 18, CARD_CANVAS_WIDTH - 36, CARD_CANVAS_HEIGHT - 36, 30);
    ctx.fillStyle = activeConfig.cardSurface;
    ctx.fill();
    ctx.strokeStyle = activeConfig.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const logoScale = activeConfig.logoScale / 100;
    drawContainedImage(ctx, logoImage, CARD_CANVAS_WIDTH / 2, 112, 390 * logoScale, 128 * logoScale);

    if (activeConfig.showTitle) {
      ctx.fillStyle = activeConfig.headingColor;
      await setCanvasFont(ctx, activeConfig.title, activeConfig.typography.title);
      ctx.fillText(activeConfig.title, CARD_CANVAS_WIDTH / 2, 198, 500);
    }

    if (activeConfig.showSubtitle) {
      ctx.fillStyle = activeConfig.mutedColor;
      await setCanvasFont(ctx, activeConfig.subtitle, activeConfig.typography.helper);
      ctx.fillText(activeConfig.subtitle, CARD_CANVAS_WIDTH / 2, 230, 540);
    }

    roundedRect(ctx, 80, 272, QR_FRAME_SIZE, QR_FRAME_SIZE, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = activeConfig.qrBorderColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.imageSmoothingEnabled = false;
    const qrX = Math.round((CARD_CANVAS_WIDTH - qrSize) / 2);
    const qrY = Math.round(272 + (QR_FRAME_SIZE - qrSize) / 2);
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    ctx.imageSmoothingEnabled = true;

    const cleanName = String(customerName || 'JOKO Member').trim().slice(0, 40);
    if (activeConfig.showCustomerName) {
      ctx.fillStyle = activeConfig.textColor;
      await setCanvasFont(ctx, cleanName, activeConfig.typography.customerName);
      ctx.fillText(cleanName, CARD_CANVAS_WIDTH / 2, 828, 540);
    }

    const cleanShortCode = String(shortCode || '').trim().slice(0, 32);
    if (activeConfig.showShortCode && cleanShortCode) {
      ctx.fillStyle = activeConfig.accentColor;
      await setCanvasFont(ctx, cleanShortCode, activeConfig.typography.shortCode);
      ctx.fillText(cleanShortCode, CARD_CANVAS_WIDTH / 2, activeConfig.showCustomerName ? 868 : 842, 520);
    }

    if (activeConfig.showFooterMark) {
      ctx.strokeStyle = activeConfig.borderColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(228, 916);
      ctx.lineTo(308, 916);
      ctx.moveTo(352, 916);
      ctx.lineTo(432, 916);
      ctx.stroke();

      ctx.fillStyle = activeConfig.accentColor;
      ctx.beginPath();
      ctx.arc(322, 916, 5, 0, Math.PI * 2);
      ctx.arc(339, 916, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (activeConfig.showFooterText) {
      ctx.fillStyle = activeConfig.mutedColor;
      await setCanvasFont(ctx, activeConfig.footerText, activeConfig.typography.helper);
      ctx.fillText(activeConfig.footerText, CARD_CANVAS_WIDTH / 2, 958, 520);
    }

    return canvas;
  };

  const getDownloadFileName = (extension: 'png' | 'pdf') => {
    const safeShortCode = String(shortCode || 'MEMBER')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '') || 'MEMBER';
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const timestamp = [
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      `${pad(now.getHours())}${pad(now.getMinutes())}`,
    ].join('-');

    return `JOKO-TODAY-${safeShortCode}-QR-${timestamp}.${extension}`;
  };

  const handleDownloadCard = async () => {
    try {
      const canvas = await renderMemberCardCanvas();
      const cardImageData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [CARD_WIDTH_MM, CARD_HEIGHT_MM],
        compress: true,
      });

      pdf.addImage(
        cardImageData,
        'PNG',
        0,
        0,
        CARD_WIDTH_MM,
        CARD_HEIGHT_MM,
        undefined,
        'FAST',
      );
      pdf.save(getDownloadFileName('pdf'));
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleDownloadImage = async () => {
    try {
      const canvas = await renderMemberCardCanvas();
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = getDownloadFileName('png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating image:', error);
    }
  };

  const logoWidth = `${Math.round(220 * activeConfig.logoScale / 100)}px`;
  const nameText = String(customerName || 'JOKO Member').trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-6">
        <div
          className="relative w-full max-w-[360px] overflow-hidden rounded-[28px] p-3 shadow-2xl"
          style={{ aspectRatio: '55 / 85', backgroundColor: activeConfig.cardBackground }}
        >
          <div
            className="flex h-full flex-col items-center rounded-[20px] border px-5 py-5 text-center sm:px-7 sm:py-6"
            style={{ backgroundColor: activeConfig.cardSurface, borderColor: activeConfig.borderColor }}
          >
            <img
              src={activeConfig.logoUrl}
              alt="JOKO TODAY"
              className="h-16 w-full object-contain sm:h-[4.5rem]"
              style={{ maxWidth: logoWidth }}
            />

            {activeConfig.showTitle && (
              <p
                className="mt-2 max-w-full truncate tracking-[0.18em]"
                style={{
                  color: activeConfig.headingColor,
                  ...textStyle(activeConfig.title, activeConfig.typography.title, activeConfig),
                  fontSize: `clamp(0.72rem, 3vw, ${activeConfig.typography.title.size}px)`,
                }}
              >
                {activeConfig.title}
              </p>
            )}

            {activeConfig.showSubtitle && (
              <p
                className="mt-1 max-w-full truncate tracking-[0.12em]"
                style={{
                  color: activeConfig.mutedColor,
                  ...textStyle(activeConfig.subtitle, activeConfig.typography.helper, activeConfig),
                  fontSize: `clamp(0.52rem, 2vw, ${activeConfig.typography.helper.size}px)`,
                }}
              >
                {activeConfig.subtitle}
              </p>
            )}

            <div
              ref={qrRef}
              className="mt-4 flex items-center justify-center rounded-2xl border bg-white p-2 sm:mt-5"
              style={{ borderColor: activeConfig.qrBorderColor }}
            >
              <QRCodeSVG
                value={String(qrValue).trim()}
                size={220}
                level="H"
                marginSize={4}
                fgColor="#000000"
                bgColor="#FFFFFF"
                className="h-auto w-full max-w-[190px] sm:max-w-[220px]"
              />
            </div>

            {(activeConfig.showCustomerName || (activeConfig.showShortCode && shortCode)) && (
              <div className="mt-4 min-w-0">
                {activeConfig.showCustomerName && (
                  <p
                    className="max-w-full truncate"
                    style={{
                      color: activeConfig.textColor,
                      ...textStyle(nameText, activeConfig.typography.customerName, activeConfig),
                      fontSize: `clamp(1rem, 4vw, ${activeConfig.typography.customerName.size}px)`,
                    }}
                  >
                    {nameText}
                  </p>
                )}
                {activeConfig.showShortCode && shortCode && (
                  <p
                    className="mt-0.5 max-w-full truncate tracking-wide"
                    style={{
                      color: activeConfig.accentColor,
                      ...textStyle(shortCode, activeConfig.typography.shortCode, activeConfig),
                      fontSize: `clamp(0.8rem, 3vw, ${activeConfig.typography.shortCode.size}px)`,
                    }}
                  >
                    {shortCode}
                  </p>
                )}
              </div>
            )}

            <div className="mt-auto pt-3">
              {activeConfig.showFooterMark && (
                <div
                  className="flex items-center justify-center gap-2"
                  style={{ color: activeConfig.accentColor }}
                  aria-hidden="true"
                >
                  <span className="h-px w-8" style={{ backgroundColor: activeConfig.borderColor }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  <span className="h-1 w-1 rounded-full bg-current" />
                  <span className="h-px w-8" style={{ backgroundColor: activeConfig.borderColor }} />
                </div>
              )}
              {activeConfig.showFooterText && (
                <p
                  className="mt-1 tracking-wide"
                  style={{
                    color: activeConfig.mutedColor,
                    ...textStyle(activeConfig.footerText, activeConfig.typography.helper, activeConfig),
                    fontSize: `clamp(0.56rem, 2vw, ${activeConfig.typography.helper.size}px)`,
                  }}
                >
                  {activeConfig.footerText}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button type="button" onClick={handleDownloadCard} className={QR_DOWNLOAD_BUTTON_CLASS}>
          <Download className="w-5 h-5" />
          {getLabel(
            'qr_page.download_card_button',
            language,
            language === 'th' ? 'ดาวน์โหลดบัตรสมาชิก' : 'Download Membership Card',
          )}
        </button>

        <button type="button" onClick={handleDownloadImage} className={QR_DOWNLOAD_BUTTON_CLASS}>
          <Download className="w-5 h-5" />
          {getLabel(
            'qr_page.download_image_button',
            language,
            language === 'th' ? 'ดาวน์โหลดรูป QR' : 'Download QR Image',
          )}
        </button>

        {secondaryAction}
      </div>

      <p className="text-xs text-gray-600 text-center">
        {getLabel(
          'qr_page.card_info',
          language,
          language === 'th'
            ? 'บันทึกไว้ในโทรศัพท์หรือพิมพ์เป็นบัตรขนาด 55 × 85 มม. สำหรับกระเป๋าสตางค์ของคุณ'
            : 'Save it to your phone or print the 55 × 85 mm card for your wallet.',
        )}
      </p>
    </div>
  );
}
