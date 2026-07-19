import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Croissant, Download, Heart } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import jsPDF from 'jspdf';

interface BrandedQRCardProps {
  qrToken: string;
  qrValue: string;
  customerName: string;
  shortCode?: string;
}

const QR_DOWNLOAD_BUTTON_CLASS =
  'w-full border border-amber-500 bg-white text-amber-700 font-semibold py-3 rounded-lg hover:border-amber-600 hover:bg-amber-600 hover:text-white hover:shadow-md focus-visible:border-amber-600 focus-visible:bg-amber-600 focus-visible:text-white focus-visible:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 transition-colors transition-shadow duration-200 flex items-center justify-center gap-2';

export function BrandedQRCard({ qrValue, customerName, shortCode }: BrandedQRCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();

  const drawCroissant = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    size: number
  ) => {
    const paths = [
      'M4.6 13.11 10.39 9.9c1.89-1.05 4.79 1.78 3.71 3.71l-3.22 5.81C8.8 23.16.79 15.23 4.6 13.11Z',
      'M10.5 9.5 9.5 7.21C9.2 6.48 8.8 6 8 6H4.5C2.79 6 2 6.5 2 8.5a7.71 7.71 0 0 0 2 4.83',
      'M8 6c0-1.55.24-4-2-4-2 0-2.5 2.17-2.5 4',
      'M14.5 13.5 16.79 14.5c.73.3 1.21.7 1.21 1.5v3.5c0 1.71-.5 2.5-2.5 2.5a7.71 7.71 0 0 1-4.83-2',
      'M18 16c1.55 0 4-.24 4 2 0 2-2.17 2.5-4 2.5',
    ];

    ctx.save();
    ctx.translate(centerX - size / 2, centerY - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = '#B6843E';
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    paths.forEach(path => ctx.stroke(new Path2D(path)));
    ctx.restore();
  };

  const roundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
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

  const renderMemberCardCanvas = async () => {
      const svg = qrRef.current?.querySelector('svg') as SVGSVGElement | undefined;
      if (!svg) throw new Error('QR SVG not found');

      const canvasWidth = 1650;
      const canvasHeight = 2550;
      const maxQrSize = 1000;
      const viewBoxSize = Math.max(1, Math.round(svg.viewBox.baseVal.width));
      const moduleScale = Math.max(1, Math.floor(maxQrSize / viewBoxSize));
      const qrSize = viewBoxSize * moduleScale;
      const qrImage = await svgToImage(svg, qrSize);

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      roundedRect(ctx, 30, 30, 1590, 2490, 88);
      ctx.fillStyle = '#FBF7EE';
      ctx.fill();

      roundedRect(ctx, 66, 66, 1518, 2418, 60);
      ctx.strokeStyle = '#C7A56A';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      drawCroissant(ctx, canvasWidth / 2, 178, 88);

      ctx.fillStyle = '#17233C';
      ctx.font = '700 88px Georgia, serif';
      ctx.fillText('JOKO TODAY', canvasWidth / 2, 290);

      ctx.strokeStyle = '#C7A56A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(310, 378);
      ctx.lineTo(570, 378);
      ctx.moveTo(1080, 378);
      ctx.lineTo(1340, 378);
      ctx.stroke();

      ctx.fillStyle = '#A87532';
      ctx.font = '600 34px Arial, sans-serif';
      ctx.fillText('BOUTIQUE BAKERY', canvasWidth / 2, 378);

      roundedRect(ctx, 235, 480, 1180, 1180, 38);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.imageSmoothingEnabled = false;
      const qrX = Math.round((canvasWidth - qrSize) / 2);
      const qrY = Math.round(480 + (1180 - qrSize) / 2);
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#A87532';
      ctx.font = 'italic 42px Georgia, serif';
      ctx.fillText('Goodness for Every Soul', canvasWidth / 2, 1750);

      ctx.strokeStyle = '#C7A56A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(435, 1840);
      ctx.lineTo(720, 1840);
      ctx.moveTo(930, 1840);
      ctx.lineTo(1215, 1840);
      ctx.stroke();
      ctx.fillStyle = '#B6843E';
      ctx.font = '38px Georgia, serif';
      ctx.fillText('♥', canvasWidth / 2, 1840);

      const cleanName = String(customerName || 'JOKO Member').trim().slice(0, 40);
      ctx.fillStyle = '#17233C';
      ctx.font = '600 66px Georgia, serif';
      ctx.fillText(cleanName, canvasWidth / 2, 1945, 1320);

      const cleanShortCode = String(shortCode || '')
        .trim()
        .slice(0, 32);

      if (cleanShortCode) {
        ctx.font = '600 44px monospace';
        const codeWidth = ctx.measureText(cleanShortCode).width;
        const iconSize = 44;
        const gap = 8;
        const groupWidth = codeWidth + gap + iconSize;
        const codeX = (canvasWidth - groupWidth) / 2;
        ctx.fillStyle = '#A87532';
        ctx.textAlign = 'left';
        ctx.fillText(cleanShortCode, codeX, 2035);
        drawCroissant(ctx, codeX + codeWidth + gap + iconSize / 2, 2035, iconSize);
        ctx.textAlign = 'center';
      }

      return canvas;
  };

  const getSafeFileName = () =>
    String(shortCode || 'card').trim().replace(/[^a-zA-Z0-9]/g, '');

  const handleDownloadCard = async () => {
    try {
      const canvas = await renderMemberCardCanvas();
      const cardImageData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageWidth = 55;
      const imageHeight = 85;
      const imageX = (pageWidth - imageWidth) / 2;
      const imageY = (pageHeight - imageHeight) / 2;

      pdf.addImage(cardImageData, 'PNG', imageX, imageY, imageWidth, imageHeight);
      pdf.save(`joko-qr-${getSafeFileName()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleDownloadImage = async () => {
    try {
      const canvas = await renderMemberCardCanvas();
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `joko-qr-${getSafeFileName()}.png`;
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
          className="relative w-full max-w-[360px] overflow-hidden rounded-[28px] bg-[#fbf7ee] p-3 shadow-2xl"
          style={{ aspectRatio: '55 / 85' }}
        >
          <div className="flex h-full flex-col items-center rounded-[20px] border border-[#c7a56a] px-5 py-5 text-center sm:px-7 sm:py-6">
            <Croissant className="h-8 w-8 shrink-0 text-[#b6843e]" strokeWidth={1.5} />
            <h2 className="mt-1 font-serif text-[1.35rem] font-bold tracking-[0.12em] text-[#17233c] sm:text-2xl">
              JOKO TODAY
            </h2>
            <div className="mt-1 flex w-full items-center justify-center gap-2 text-[#a87532]">
              <span className="h-px max-w-14 flex-1 bg-[#c7a56a]" />
              <span className="whitespace-nowrap text-[0.58rem] font-semibold tracking-[0.2em] sm:text-[0.65rem]">
                BOUTIQUE BAKERY
              </span>
              <span className="h-px max-w-14 flex-1 bg-[#c7a56a]" />
            </div>

            <div ref={qrRef} className="mt-4 flex items-center justify-center rounded-xl bg-white p-2 shadow-sm sm:mt-5">
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

            <p className="mt-3 font-serif text-xs italic text-[#a87532] sm:text-sm">
              Goodness for Every Soul
            </p>

            <div className="mt-2 flex w-full items-center justify-center gap-2 text-[#b6843e]">
              <span className="h-px max-w-16 flex-1 bg-[#c7a56a]" />
              <Heart className="h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
              <span className="h-px max-w-16 flex-1 bg-[#c7a56a]" />
            </div>

            <div className="mt-2 min-w-0">
              <p className="truncate font-serif text-lg font-semibold text-[#17233c] sm:text-[1.25rem]">
                {customerName}
              </p>
              {shortCode && (
                <div className="mt-0.5 flex items-center justify-center gap-1 text-[#a87532]">
                  <span className="font-mono text-[0.825rem] font-semibold tracking-wide sm:text-[0.95rem]">{shortCode}</span>
                  <Croissant className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleDownloadCard}
          className={QR_DOWNLOAD_BUTTON_CLASS}
        >
          <Download className="w-5 h-5" />
          {getLabel('qr_page.download_card_button', language,
            language === 'th' ? 'ดาวน์โหลดบัตรสมาชิก' : 'Download Membership Card'
          )}
        </button>

        <button
          onClick={handleDownloadImage}
          className={QR_DOWNLOAD_BUTTON_CLASS}
        >
          <Download className="w-5 h-5" />
          {getLabel('qr_page.download_image_button', language,
            language === 'th' ? 'ดาวน์โหลดรูป QR' : 'Download QR Image'
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
