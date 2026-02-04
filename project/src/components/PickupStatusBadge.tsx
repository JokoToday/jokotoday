import React from 'react';
import { AlertCircle, Clock, CheckCircle, Zap } from 'lucide-react';
import { PickupStatus } from '../lib/availabilityService';

interface PickupStatusBadgeProps {
  status: PickupStatus;
  language: 'en' | 'th';
}

const statusConfig: Record<PickupStatus, { en: string; th: string; color: string; icon: React.ReactNode }> = {
  available: {
    en: 'Available Today',
    th: 'พร้อมรับวันนี้',
    color: 'bg-green-100 text-green-700 border-green-300',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  closing_soon: {
    en: 'Closing Soon',
    th: 'ใกล้ปิดรับออเดอร์',
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    icon: <Clock className="w-4 h-4" />,
  },
  closed: {
    en: 'Closed',
    th: 'ปิดรับแล้ว',
    color: 'bg-red-100 text-red-700 border-red-300',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  sold_out: {
    en: 'Sold Out',
    th: 'สินค้าหมด',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  holiday: {
    en: 'Not Available (Holiday)',
    th: 'ไม่เปิดรับออเดอร์ (วันหยุด)',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

export function PickupStatusBadge({ status, language }: PickupStatusBadgeProps) {
  const config = statusConfig[status];
  const text = language === 'th' ? config.th : config.en;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium ${config.color}`}>
      {config.icon}
      {text}
    </div>
  );
}
