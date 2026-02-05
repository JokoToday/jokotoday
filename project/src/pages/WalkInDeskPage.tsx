import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export function WalkInDeskPage() {
  const { language } = useLanguage();
  const params = new URLSearchParams(window.location.search);
  const shortCode = params.get('code');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        {language === 'th' ? 'ลูกค้า Walk-in' : 'Walk-in Customer'}
      </h1>

      {shortCode ? (
        <p className="text-lg">
          {language === 'th'
            ? `รหัสลูกค้า: ${shortCode}`
            : `Customer Code: ${shortCode}`}
        </p>
      ) : (
        <p>No customer code provided.</p>
      )}
    </div>
  );
}
