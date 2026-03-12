import React from 'react';
import { ChevronDown, ShoppingBag } from 'lucide-react';
import { Order } from './OrderTypes';

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

export function OrderCard({ order, language, getLabel, onClick }: OrderCardProps) {
  const isOnline = order.purchase_type === 'online' || !order.purchase_type;
  const total = isOnline ? order.total_amount : (order.walk_in_amount || order.total_amount);

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
              {(order.loyalty_points_earned != null && order.loyalty_points_earned > 0) && (
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
