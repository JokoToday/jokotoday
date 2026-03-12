import React from 'react';
import { X, ShoppingBag, ExternalLink, MapPin, Calendar, Package, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Order, OrderItem, PickupDay, PickupLocation } from './OrderTypes';
import { CMSProduct } from '../../lib/cmsService';

interface OrderDetailModalProps {
  order: Order;
  language: 'en' | 'th' | 'zh';
  productMap: Record<string, CMSProduct>;
  pickupDays: PickupDay[];
  locationMap: Record<string, PickupLocation>;
  getLabel: (key: string, lang: 'en' | 'th' | 'zh', fallback: string) => string;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onCancelRequest: (order: Order) => void;
}

export function OrderDetailModal({
  order,
  language,
  productMap,
  pickupDays,
  locationMap,
  getLabel,
  onClose,
  onNavigate,
  onCancelRequest,
}: OrderDetailModalProps) {
  const items: OrderItem[] = order.order_items || [];

  const getPickupDayLabel = (val: string): string => {
    if (!val) return '—';
    const match = pickupDays.find(pd => pd.label === val || pd.label_en === val);
    if (!match) return val;
    if (language === 'th') return match.label_th || match.label_en;
    if (language === 'zh') return match.label_zh || match.label_en;
    return match.label_en;
  };

  const getLocationInfo = (locationId: string | null): { name: string; mapsUrl: string | null } => {
    if (!locationId) return { name: '—', mapsUrl: null };
    const loc = locationMap[locationId];
    if (!loc) return { name: '—', mapsUrl: null };
    const name = language === 'th' ? loc.name_th || loc.name_en : language === 'zh' ? loc.name_zh || loc.name_en : loc.name_en;
    return { name, mapsUrl: loc.maps_url };
  };

  const getLocationInfoForDay = (dayVal: string): { name: string; mapsUrl: string | null } => {
    if (!dayVal) return { name: '—', mapsUrl: null };
    const day = pickupDays.find(d => d.label_en === dayVal || d.label_th === dayVal || d.label_zh === dayVal || d.label === dayVal);
    if (!day?.location_id) return { name: '—', mapsUrl: null };
    return getLocationInfo(day.location_id);
  };

  const locationInfo = order.pickup_location_id
    ? getLocationInfo(order.pickup_location_id)
    : getLocationInfoForDay(order.pickup_day);

  const getProductName = (item: OrderItem): string => {
    const p = productMap[item.product_id];
    if (!p) return item.product_name;
    if (language === 'th') return p.name_th || p.name_en;
    if (language === 'zh') return p.name_zh || p.name_en;
    return p.name_en;
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      pending:   { label: getLabel('orders_page.status_pending',   language, 'Pending'),          color: 'bg-amber-100 text-amber-800 border-amber-200',   icon: <Clock       className="w-3.5 h-3.5" /> },
      confirmed: { label: getLabel('orders_page.status_confirmed', language, 'Confirmed'),        color: 'bg-blue-100 text-blue-800 border-blue-200',       icon: <CheckCircle className="w-3.5 h-3.5" /> },
      ready:     { label: getLabel('orders_page.status_ready',     language, 'Ready for Pickup'), color: 'bg-green-100 text-green-800 border-green-200',    icon: <Package     className="w-3.5 h-3.5" /> },
      picked_up: { label: getLabel('orders_page.status_picked_up', language, 'Picked Up'),       color: 'bg-gray-100 text-gray-700 border-gray-200',       icon: <CheckCircle className="w-3.5 h-3.5" /> },
      cancelled: { label: getLabel('orders_page.status_cancelled', language, 'Cancelled'),       color: 'bg-red-100 text-red-800 border-red-200',          icon: <XCircle     className="w-3.5 h-3.5" /> },
      completed: { label: 'Completed',                                                            color: 'bg-gray-100 text-gray-700 border-gray-200',       icon: <CheckCircle className="w-3.5 h-3.5" /> },
    };
    return configs[status] || { label: status, color: 'bg-gray-100 text-gray-700 border-gray-200', icon: null };
  };

  const statusConfig = getStatusConfig(order.status);
  const isOnline = order.purchase_type === 'online' || !order.purchase_type;
  const subtotal = items.reduce((sum, i) => sum + i.price_at_order * i.quantity, 0);
  const total = Number(isOnline ? order.total_amount : (order.walk_in_amount || order.total_amount));
  const discount = subtotal > total ? subtotal - total : 0;

  const isCancellable = (order.status === 'pending' || order.status === 'confirmed') && isOnline;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[88vh] overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-stone-100"
          style={{ background: 'linear-gradient(135deg, #f6f1e7 0%, #fdf8f0 100%)' }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#c6a75e' }}>
              {getLabel('my_orders_page.order_number', language, 'Order')} #{order.order_number}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.color}`}
              >
                {statusConfig.icon}
                {statusConfig.label}
              </span>
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border"
                style={{ background: isOnline ? '#eff6ff' : '#f0fdf4', color: isOnline ? '#1d4ed8' : '#15803d', borderColor: isOnline ? '#bfdbfe' : '#bbf7d0' }}
              >
                {isOnline
                  ? getLabel('my_orders_page.online_order', language, 'Online Order')
                  : getLabel('my_orders_page.in_store_order', language, 'In-Store Order')}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-stone-500 hover:text-stone-800 transition-all shadow-sm"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {isOnline && (
          <div className="grid grid-cols-2 gap-px bg-stone-100 border-b border-stone-100">
            {[
              {
                label: language === 'zh' ? '取货日' : language === 'th' ? 'วันรับสินค้า' : 'Pickup Day',
                value: (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: '#c6a75e' }} />
                    {getPickupDayLabel(order.pickup_day) || '—'}
                  </span>
                ),
              },
              {
                label: language === 'zh' ? '取货地点' : language === 'th' ? 'จุดรับสินค้า' : 'Pickup Location',
                value: locationInfo.mapsUrl ? (
                  <a
                    href={locationInfo.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 underline underline-offset-2"
                    style={{ color: '#c6a75e' }}
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {locationInfo.name}
                  </a>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#c6a75e' }} />
                    {locationInfo.name}
                  </span>
                ),
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white px-4 py-3">
                <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide mb-1">{label}</p>
                <div className="text-sm font-medium text-stone-800">{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
            {language === 'zh' ? '商品明细' : language === 'th' ? 'รายการสินค้า' : 'Items'}
          </p>

          {items.length === 0 ? (
            <div className="py-8 text-center text-stone-400 text-sm">
              {language === 'zh' ? '暂无商品详情' : language === 'th' ? 'ไม่มีข้อมูลสินค้า' : 'No item details available'}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => {
                const product = productMap[item.product_id];
                const img = product?.image;
                const slug = product?.slug;
                const displayName = getProductName(item);
                const lineTotal = item.price_at_order * item.quantity;

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-amber-50 shrink-0 border border-amber-100">
                      {img ? (
                        <img
                          src={img}
                          alt={displayName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-amber-300" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {slug ? (
                        <button
                          onClick={() => { onNavigate(`product/${slug}`); onClose(); }}
                          className="text-sm font-semibold text-stone-900 hover:underline flex items-center gap-1 group text-left truncate max-w-full"
                          title={displayName}
                        >
                          <span className="truncate">{displayName}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </button>
                      ) : (
                        <p className="text-sm font-semibold text-stone-900 truncate">{displayName}</p>
                      )}
                      <p className="text-xs text-stone-400 mt-0.5">
                        {getLabel('my_orders_page.quantity', language, 'Qty')}: {item.quantity}
                        {' · '}
                        {getLabel('my_orders_page.unit_price', language, 'Unit Price')}: ฿{Number(item.price_at_order).toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-stone-800">฿{lineTotal.toFixed(2)}</p>
                      <p className="text-xs text-stone-400">{getLabel('my_orders_page.line_total', language, 'Total')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-stone-100 px-5 py-4 bg-stone-50/60">
          {items.length > 0 && (
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-sm text-stone-500">
                <span>{getLabel('my_orders_page.subtotal', language, 'Subtotal')}</span>
                <span>฿{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-sm text-emerald-600">
                  <span>— {getLabel('my_orders_page.discount', language, 'Discount')}</span>
                  <span>-฿{discount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <div
            className="flex items-center justify-between py-3 px-4 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #f6f1e7 0%, #fdf8f0 100%)', border: '1px solid #e8d9b8' }}
          >
            <span className="text-sm font-semibold text-stone-700">
              {getLabel('my_orders_page.total', language, 'Total')}
            </span>
            <span className="text-2xl font-extrabold" style={{ color: '#c6a75e' }}>
              ฿{total.toFixed(2)}
            </span>
          </div>

          {(order.loyalty_points_earned != null && order.loyalty_points_earned > 0) && (
            <div
              className="mt-3 flex items-center gap-2.5 px-4 py-3 rounded-xl"
              style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a' }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ background: '#c6a75e', color: '#fff' }}
              >
                ★
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-700 font-semibold">
                  {getLabel('my_orders_page.loyalty_points_earned', language, 'Points Earned')}
                </p>
              </div>
              <span className="text-base font-extrabold" style={{ color: '#92400e' }}>
                +{order.loyalty_points_earned}
              </span>
            </div>
          )}

          {isCancellable && (
            <button
              onClick={() => { onCancelRequest(order); onClose(); }}
              className="mt-3 w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
            >
              {language === 'zh' ? '取消订单' : language === 'th' ? 'ยกเลิกคำสั่งซื้อ' : 'Cancel Order'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
