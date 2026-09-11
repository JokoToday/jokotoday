import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrandedQRCard } from '../components/BrandedQRCard';
import { LanguageProvider } from '../context/LanguageContext';
import '../index.css';

const PREVIEW_QR_VALUE = 'https://joko.today/';

function QrPassPreview() {
  if (!import.meta.env.DEV) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-stone-900">Preview unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            QR Pass v2 preview is intentionally available only from the local Vite development server.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f0e8] px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 rounded-2xl border border-[#d7d1c5] bg-white/90 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6f36]">
                Development preview
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-[#243128]">QR Pass v2</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                This page uses dummy member data and a harmless QR that points only to the JOKO TODAY homepage.
                It does not display, regenerate, or modify any real customer QR credential.
              </p>
            </div>
            <div className="rounded-full bg-[#e5eadf] px-3 py-1.5 text-xs font-semibold text-[#526349]">
              SAFE TEST DATA
            </div>
          </div>

          <div className="mt-4 grid gap-2 rounded-xl bg-stone-50 p-4 text-sm text-stone-700 sm:grid-cols-3">
            <div><span className="font-semibold">Name:</span> Joe Example</div>
            <div><span className="font-semibold">Code:</span> VIP123</div>
            <div><span className="font-semibold">QR target:</span> joko.today</div>
          </div>
        </div>

        <div className="rounded-3xl border border-[#d7d1c5] bg-white p-4 shadow-xl sm:p-8">
          <BrandedQRCard
            qrToken="preview-only-not-a-real-token"
            qrValue={PREVIEW_QR_VALUE}
            customerName="Joe Example"
            shortCode="VIP123"
          />
        </div>

        <div className="mt-6 rounded-2xl border border-[#d7d1c5] bg-white/80 p-5 text-sm leading-6 text-stone-600">
          <p className="font-semibold text-stone-800">What to test</p>
          <p className="mt-1">
            Review the logo and layout, download both PDF and PNG, confirm the PDF page is 55 × 85 mm,
            and scan both files with a phone. A successful scan should open the JOKO TODAY homepage.
          </p>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <QrPassPreview />
    </LanguageProvider>
  </React.StrictMode>,
);
