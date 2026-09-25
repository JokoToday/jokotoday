import { useMemo, useRef, useState } from 'react';
import { Copy, Download, ExternalLink, Printer, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import { CMSProduct } from '../lib/cmsService';
import { useLanguage } from '../context/LanguageContext';

type SupportedLanguage = 'en' | 'th' | 'zh';

interface ProductQRPanelProps {
  product: CMSProduct;
  onClose?: () => void;
}

const SHELF_TAG_WIDTH_MM = 70;
const SHELF_TAG_HEIGHT_MM = 100;
const SHELF_TAG_CANVAS_WIDTH = 840;
const SHELF_TAG_CANVAS_HEIGHT = 1200;

const copy = {
  en: {
    title: 'Product QR',
    permanent: 'Permanent public product code',
    destination: 'Destination',
    copy: 'Copy URL',
    copied: 'Copied',
    open: 'Open product',
    png: 'Download QR PNG',
    svg: 'Download QR SVG',
    pdf: 'Download shelf tag PDF',
    printHint: 'Shelf tag: 70 × 100 mm',
    scan: 'SCAN',
    noCode: 'This product does not have a permanent QR code yet.',
  },
  th: {
    title: 'QR สินค้า',
    permanent: 'รหัสสินค้าสาธารณะแบบถาวร',
    destination: 'ปลายทาง',
    copy: 'คัดลอก URL',
    copied: 'คัดลอกแล้ว',
    open: 'เปิดหน้าสินค้า',
    png: 'ดาวน์โหลด QR PNG',
    svg: 'ดาวน์โหลด QR SVG',
    pdf: 'ดาวน์โหลดป้ายสินค้า PDF',
    printHint: 'ป้ายสินค้า: 70 × 100 มม.',
    scan: 'สแกน',
    noCode: 'สินค้านี้ยังไม่มีรหัส QR ถาวร',
  },
  zh: {
    title: '商品二维码',
    permanent: '永久公开商品代码',
    destination: '目标地址',
    copy: '复制链接',
    copied: '已复制',
    open: '打开商品页',
    png: '下载二维码 PNG',
    svg: '下载二维码 SVG',
    pdf: '下载商品标签 PDF',
    printHint: '商品标签：70 × 100 毫米',
    scan: '扫码',
    noCode: '此商品尚未设置永久二维码。',
  },
} as const;

function safeFilePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'product';
}

function localizedName(product: CMSProduct, language: SupportedLanguage): string {
  if (language === 'th') return product.name_th || product.name_en;
  if (language === 'zh') return product.name_zh || product.name_en;
  return product.name_en;
}

export function ProductQRPanel({ product, onClose }: ProductQRPanelProps) {
  const { language } = useLanguage();
  const lang = language as SupportedLanguage;
  const labels = copy[lang];
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const publicCode = String(product.public_code || '').trim().toUpperCase();
  const qrUrl = useMemo(
    () => publicCode ? `${window.location.origin}/p/${encodeURIComponent(publicCode)}` : '',
    [publicCode],
  );
  const canonicalUrl = useMemo(
    () => `${window.location.origin}/products/${encodeURIComponent(product.slug)}`,
    [product.slug],
  );

  const getQrSvg = () => qrRef.current?.querySelector('svg') as SVGSVGElement | null;

  const copyUrl = async () => {
    if (!qrUrl) return;
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const downloadSvg = () => {
    const svg = getQrSvg();
    if (!svg || !publicCode) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `JOKO-${safeFilePart(publicCode)}-QR.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const qrSvgToImage = (size: number): Promise<HTMLImageElement> => {
    const svg = getQrSvg();
    if (!svg) return Promise.reject(new Error('QR SVG not found'));

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(size));
    clone.setAttribute('height', String(size));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not render product QR'));
      };
      image.src = url;
    });
  };

  const downloadPng = async () => {
    if (!publicCode) return;
    const image = await qrSvgToImage(720);
    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 840;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 60, 60, 720, 720);
    ctx.imageSmoothingEnabled = true;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `JOKO-${safeFilePart(publicCode)}-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadShelfTagPdf = async () => {
    if (!publicCode) return;
    const qrImage = await qrSvgToImage(400);
    const canvas = document.createElement('canvas');
    canvas.width = SHELF_TAG_CANVAS_WIDTH;
    canvas.height = SHELF_TAG_CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#F6F0E3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#55766F';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(35, 35, canvas.width - 70, canvas.height - 70, 38);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#3F665E';
    ctx.font = '700 42px Arial, sans-serif';
    ctx.fillText('JOKO TODAY', canvas.width / 2, 112);

    ctx.fillStyle = '#292D2B';
    ctx.font = '700 39px Arial, sans-serif';
    ctx.fillText(product.name_en.slice(0, 34), canvas.width / 2, 205, 700);

    if (product.name_th) {
      ctx.font = '600 29px Arial, sans-serif';
      ctx.fillText(product.name_th.slice(0, 40), canvas.width / 2, 255, 700);
    }

    if (product.name_zh) {
      ctx.font = '600 29px Arial, sans-serif';
      ctx.fillText(product.name_zh.slice(0, 40), canvas.width / 2, 302, 700);
    }

    ctx.fillStyle = '#C76624';
    ctx.font = '700 54px Arial, sans-serif';
    ctx.fillText(`฿${Number(product.price).toFixed(0)}`, canvas.width / 2, 382);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(190, 445, 460, 460, 24);
    ctx.fill();

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrImage, 220, 475, 400, 400);
    ctx.imageSmoothingEnabled = true;

    ctx.fillStyle = '#303532';
    ctx.font = '700 27px Arial, sans-serif';
    ctx.fillText('SCAN • สแกน • 扫码', canvas.width / 2, 958);

    ctx.fillStyle = '#55766F';
    ctx.font = '600 22px Arial, sans-serif';
    ctx.fillText('joko.today', canvas.width / 2, 1010);

    ctx.fillStyle = '#7A746A';
    ctx.font = '500 18px Arial, sans-serif';
    ctx.fillText(publicCode, canvas.width / 2, 1062);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [SHELF_TAG_WIDTH_MM, SHELF_TAG_HEIGHT_MM],
      compress: true,
    });

    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      0,
      0,
      SHELF_TAG_WIDTH_MM,
      SHELF_TAG_HEIGHT_MM,
      undefined,
      'FAST',
    );
    pdf.save(`JOKO-${safeFilePart(publicCode)}-${safeFilePart(product.slug)}-shelf-tag.pdf`);
  };

  if (!publicCode) {
    return (
      <div className={onClose ? 'fixed inset-0 z-[90] flex items-center justify-center p-4' : ''}>
        {onClose && <button type="button" className="fixed inset-0 bg-black/55" onClick={onClose} aria-label="Close" />}
        <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          {onClose && (
            <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          )}
          <p className="text-sm text-gray-600">{labels.noCode}</p>
        </div>
      </div>
    );
  }

  const panel = (
    <div className="relative w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-[#55766F]/18 bg-[#FFF9EE] shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-[#55766F]/15 px-6 py-5">
        <div>
          <div className="flex items-center gap-2 text-[#3F665E]">
            <QrCode className="h-5 w-5" />
            <h2 className="text-xl font-semibold">{labels.title}</h2>
          </div>
          <p className="mt-1 text-sm text-[#303532]/65">{localizedName(product, lang)}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[#303532]/70 hover:bg-[#CFE3DF]/55">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-[260px_1fr]">
        <div>
          <div ref={qrRef} className="mx-auto flex aspect-square w-full max-w-[250px] items-center justify-center rounded-2xl border border-[#55766F]/15 bg-white p-4">
            <QRCodeSVG
              value={qrUrl}
              size={230}
              level="H"
              marginSize={4}
              fgColor="#111111"
              bgColor="#FFFFFF"
              className="h-auto w-full"
            />
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-[#303532]/50">{labels.permanent}</p>
            <p className="mt-1 font-mono text-lg font-bold text-[#C76624]">{publicCode}</p>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="rounded-2xl border border-[#55766F]/12 bg-white/65 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#303532]/45">{labels.destination}</p>
            <p className="mt-2 break-all font-mono text-sm text-[#303532]">{qrUrl}</p>
            <p className="mt-2 text-xs text-[#303532]/50">Canonical: {canonicalUrl}</p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => void copyUrl()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#55766F]/25 bg-white px-4 py-3 text-sm font-semibold text-[#303532] hover:bg-[#CFE3DF]/35">
              <Copy className="h-4 w-4" />
              {copied ? labels.copied : labels.copy}
            </button>
            <a href={canonicalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#55766F]/25 bg-white px-4 py-3 text-sm font-semibold text-[#303532] hover:bg-[#CFE3DF]/35">
              <ExternalLink className="h-4 w-4" />
              {labels.open}
            </a>
            <button type="button" onClick={downloadPng} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#55766F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#46665F]">
              <Download className="h-4 w-4" />
              {labels.png}
            </button>
            <button type="button" onClick={downloadSvg} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#55766F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#46665F]">
              <Download className="h-4 w-4" />
              {labels.svg}
            </button>
          </div>

          <button type="button" onClick={() => void downloadShelfTagPdf()} className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#C76624] px-5 py-3.5 font-semibold text-white hover:bg-[#A95120]">
            <Printer className="h-5 w-5" />
            {labels.pdf}
          </button>
          <p className="mt-2 text-center text-xs text-[#303532]/55">{labels.printHint}</p>
        </div>
      </div>
    </div>
  );

  if (!onClose) return panel;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      {panel}
    </div>
  );
}

export default ProductQRPanel;
