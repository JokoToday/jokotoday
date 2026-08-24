import React from 'react';
import { ChevronDown, ShoppingBag } from 'lucide-react';
import { Order } from './OrderTypes';
import { isPickupDatePast } from '../../lib/availabilityService';

interface OrderCardProps {
  order: Order;
  language: 'en' | 'th' | 'zh';
  getLabel: (key: string, lang: 'en' | 'th' | 'zh', fallback: string) => string;
  onClick: () => void;
}

function formatFullDate(dateString: string, language: 'en' | 'th' | 'zh'): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(
    language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }
  );
}

function formatPickupDate(dateString: string, language: 'en' | 'th' | 'zh'): string {
  if (!dateString) return '—';
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;

  const d = new Date(Date.UTC(year, month - 1, day, 12));
  return d.toLocaleDateString(
    language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
  );
}

function getTerminalStatus(
  status: string,
  language: 'en' | 'th' | 'zh'
): { label: string; style: React.CSSProperties } | null {
  if (status === 'cancelled') {
    return {
      label: language === 'th' ? 'ยกเลิกแล้ว' : language === 'zh' ? '已取消' : 'Cancelled',
      style: { background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' },
    };
  }

  if (status === 'picked_up') {
    return {
      label: language === 'th' ? 'รับสินค้าแล้ว' : language === 'zh' ? '已取货' : 'Picked Up',
      style: { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' },
    };
  }

  if (status === 'completed') {
    return {
      label: language === 'th' ? 'เสร็จสิ้น' : language === 'zh' ? '已完成' : 'Completed',
      style: { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' },
    };
  }

  return null;
}

export function OrderCard({ order, language, getLabel, onClick }: OrderCardProps) {
  const isOnline = order.purchase_type === 'online' || !order.purchase_type;
  const total = isOnline ? order.total_amount : (order.walk_in_amount || order.total_amount);
  const terminalStatus = getTerminalStatus(order.status, language);
  const unresolvedPastPickup = isOnline
    && ['pending', 'confirmed', 'ready'].includes(order.status)
    && isPickupDatePast(order.pickup_date);

  return (
    <button
      onClick={onClick}
      className="w-full text-left group"
    >
      <div
        className="bg-white rounded-xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
        style={{ borderColor: '#e8d9b8', boxShadow: '0 1px 4px rgba(198,167,94,0.08)' }}
      >
        <div className="px-4 py-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #f6f1e7 0%, #fdf8f0 100%)', border: '1px solid #e8d9b8' }}
          >
            <ShoppingBag className="w-4.5 h-4.5" style={{ color: '#c6a75e' }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-0.5">
                  {getLabel('my_orders_page.order_number', language, 'Order')} #{order.order_number}
                </p>
                <p className="text-xs text-stone-500">{formatFullDate(order.created_at, language)}</p>
                {isOnline && order.pickup_date && (
                  <p className="text-xs font-semibold mt-1" style={{ color: unresolvedPastPickup ? '#b45309' : '#9a7b2f' }}>
                    {getLabel('my_orders_page.pickup_day', language, 'Pickup')}: {formatPickupDate(order.pickup_date, language)}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p
                  className="text-lg font-extrabold leading-none"
                  style={{ color: '#c6a75e' }}
                >
                  ฿{Number(total).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
                style={
                  isOnline
                    ? { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }
                    : { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }
                }
              >
                {isOnline
                  ? getLabel('my_orders_page.online_order', language, 'Online Order')
                  : getLabel('my_orders_page.in_store_order', language, 'In-Store Order')}
              </span>
              {terminalStatus && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
                  style={terminalStatus.style}
                >
                  {terminalStatus.label}
                </span>
              )}
              {unresolvedPastPickup && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-amber-50 text-amber-800 border-amber-200">
                  {language === 'th' ? 'เลยวันรับสินค้า' : language === 'zh' ? '取货日期已过' : 'Pickup date passed'}
                </span>
              )}
              {(order.status !== 'cancelled' && order.loyalty_points_earned != null && order.loyalty_points_earned > 0) && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border"
                  style={{ background: '#fffbeb', color: '#92400e', borderColor: '#fde68a' }}
                >
                  <span style={{ fontSize: '10px' }}>★</span>
                  +{order.loyalty_points_earned} {getLabel('my_orders_page.loyalty_points_earned', language, 'pts')}
                </span>
              )}
            </div>
          </div>

          <ChevronDown
            className="w-4 h-4 shrink-0 text-stone-300 group-hover:text-stone-500 transition-all duration-200 group-hover:translate-y-0.5"
          />
        </div>
      </div>
    </button>
  );
}
