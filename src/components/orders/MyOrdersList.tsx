import React, { useState, useMemo } from 'react';
import { ChevronDown, ShoppingBag, Zap, Clock } from 'lucide-react';
import { Order, PickupDay, PickupLocation, SortOption } from './OrderTypes';
import { OrderCard } from './OrderCard';
import { OrderDetailModal } from './OrderDetailModal';
import { CMSProduct } from '../../lib/cmsService';

const PAGE_SIZE = 20;

const CURRENT_STATUSES = new Set(['pending', 'confirmed', 'ready']);
const PAST_STATUSES = new Set(['picked_up', 'cancelled', 'completed', 'walk_in']);

interface MyOrdersListProps {
  orders: Order[];
  language: 'en' | 'th' | 'zh';
  productMap: Record<string, CMSProduct>;
  pickupDays: PickupDay[];
  locationMap: Record<string, PickupLocation>;
  getLabel: (key: string, lang: 'en' | 'th' | 'zh', fallback: string) => string;
  onNavigate: (page: string) => void;
  onCancelRequest: (order: Order) => void;
}

function isCurrentOrder(order: Order): boolean {
  if (order.purchase_type === 'walk_in') return false;
  return CURRENT_STATUSES.has(order.status);
}

function formatDateHeader(dateString: string, language: 'en' | 'th' | 'zh'): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(
    language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }
  );
}

function groupByDate(orders: Order[]): Map<string, Order[]> {
  const map = new Map<string, Order[]>();
  for (const order of orders) {
    const key = order.created_at ? order.created_at.slice(0, 10) : 'unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(order);
  }
  return map;
}

interface OrderColumnProps {
  title: string;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
  orders: Order[];
  language: 'en' | 'th' | 'zh';
  productMap: Record<string, CMSProduct>;
  pickupDays: PickupDay[];
  locationMap: Record<string, PickupLocation>;
  getLabel: (key: string, lang: 'en' | 'th' | 'zh', fallback: string) => string;
  onNavigate: (page: string) => void;
  onCancelRequest: (order: Order) => void;
  emptyMessage: string;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
  sortOptions: { value: SortOption; label: string }[];
  sortLabel: string;
}

function OrderColumn({
  title,
  icon,
  accentBg,
  orders,
  language,
  productMap,
  pickupDays,
  locationMap,
  getLabel,
  onNavigate,
  onCancelRequest,
  emptyMessage,
  sort,
  onSortChange,
  sortOptions,
  sortLabel,
}: OrderColumnProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const copy = [...orders];
    switch (sort) {
      case 'oldest':
        return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'price_asc':
        return copy.sort((a, b) => Number(a.total_amount) - Number(b.total_amount));
      case 'price_desc':
        return copy.sort((a, b) => Number(b.total_amount) - Number(a.total_amount));
      default:
        return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [orders, sort]);

  const paginated = useMemo(() => sorted.slice(0, page * PAGE_SIZE), [sorted, page]);
  const grouped = useMemo(() => groupByDate(paginated), [paginated]);
  const hasMore = sorted.length > page * PAGE_SIZE;
  const currentSortLabel = sortOptions.find(o => o.value === sort)?.label || '';

  return (
    <div className="flex flex-col min-h-0">
      <div
        className="flex items-center justify-between px-4 py-3 rounded-t-xl mb-0"
        style={{ background: accentBg, border: '1px solid #e8d9b8', borderBottom: 'none' }}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-bold text-stone-700">{title}</span>
          {orders.length > 0 && (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white"
              style={{ background: '#c6a75e' }}
            >
              {orders.length}
            </span>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setSortOpen(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 rounded-lg border text-xs font-medium text-stone-600 hover:bg-white transition-colors"
            style={{ borderColor: '#e8d9b8' }}
          >
            <span className="hidden sm:inline text-stone-400">
              {sortLabel}:
            </span>
            <span className="max-w-[80px] truncate">{currentSortLabel}</span>
            <ChevronDown
              className={`w-3 h-3 text-stone-400 transition-transform duration-200 shrink-0 ${sortOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {sortOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border overflow-hidden min-w-[190px]"
                style={{ borderColor: '#e8d9b8' }}
              >
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { onSortChange(opt.value); setSortOpen(false); setPage(1); }}
                    className="w-full text-left px-4 py-2.5 text-xs transition-colors"
                    style={sort === opt.value
                      ? { color: '#c6a75e', background: '#fdf8f0', fontWeight: 600 }
                      : { color: '#57534e' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className="flex-1 rounded-b-xl overflow-auto"
        style={{ background: '#ffffff', border: '1px solid #e8d9b8' }}
      >
        {orders.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center px-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ background: '#f6f1e7', border: '1px solid #e8d9b8' }}
            >
              <ShoppingBag className="w-5 h-5" style={{ color: '#c6a75e' }} />
            </div>
            <p className="text-sm text-stone-400">{emptyMessage}</p>
          </div>
        ) : (
          <div className="p-3 space-y-5">
            {Array.from(grouped.entries()).map(([dateKey, dayOrders]) => (
              <div key={dateKey}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1" style={{ background: '#e8d9b8' }} />
                  <span className="text-xs font-semibold tracking-wide text-stone-400 shrink-0">
                    {formatDateHeader(dateKey + 'T00:00:00', language)}
                  </span>
                  <div className="h-px flex-1" style={{ background: '#e8d9b8' }} />
                </div>
                <div className="space-y-2">
                  {dayOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      language={language}
                      getLabel={getLabel}
                      onClick={() => setSelectedOrder(order)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-stone-50"
                  style={{ borderColor: '#c6a75e', color: '#c6a75e' }}
                >
                  {language === 'zh' ? '加载更多' : language === 'th' ? 'โหลดเพิ่มเติม' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          language={language}
          productMap={productMap}
          pickupDays={pickupDays}
          locationMap={locationMap}
          getLabel={getLabel}
          onClose={() => setSelectedOrder(null)}
          onNavigate={onNavigate}
          onCancelRequest={onCancelRequest}
        />
      )}
    </div>
  );
}

export function MyOrdersList({
  orders,
  language,
  productMap,
  pickupDays,
  locationMap,
  getLabel,
  onNavigate,
  onCancelRequest,
}: MyOrdersListProps) {
  const [currentSort, setCurrentSort] = useState<SortOption>('newest');
  const [pastSort, setPastSort] = useState<SortOption>('newest');

  const currentOrders = useMemo(() => orders.filter(isCurrentOrder), [orders]);
  const pastOrders = useMemo(() => orders.filter(o => !isCurrentOrder(o)), [orders]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest',     label: getLabel('my_orders_page.sort_newest_oldest',  language, 'Newest to Oldest') },
    { value: 'oldest',     label: getLabel('my_orders_page.sort_oldest_newest',  language, 'Oldest to Newest') },
    { value: 'price_asc',  label: getLabel('my_orders_page.sort_price_low_high', language, 'Price: Low to High') },
    { value: 'price_desc', label: getLabel('my_orders_page.sort_price_high_low', language, 'Price: High to Low') },
  ];

  const sortLabel = getLabel('my_orders_page.sort_label', language, 'Sort');
  const currentTitle = getLabel('my_orders_page.current_orders', language, 'Current Orders');
  const pastTitle = getLabel('my_orders_page.past_orders', language, 'Past Orders');

  const emptyCurrentMsg = language === 'zh' ? '暂无进行中的订单' : language === 'th' ? 'ไม่มีคำสั่งซื้อที่กำลังดำเนินการ' : 'No active orders';
  const emptyPastMsg = language === 'zh' ? '暂无历史订单' : language === 'th' ? 'ยังไม่มีคำสั่งซื้อในอดีต' : 'No past orders yet';

  if (orders.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
          style={{ background: '#f6f1e7', border: '1px solid #e8d9b8' }}
        >
          <ShoppingBag className="w-7 h-7" style={{ color: '#c6a75e' }} />
        </div>
        <p className="text-base font-semibold text-stone-600 mb-1">
          {getLabel('my_orders_page.no_orders_message', language, 'You have no orders yet.')}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <OrderColumn
        title={currentTitle}
        icon={<Clock className="w-4 h-4" style={{ color: '#c6a75e' }} />}
        accent="#c6a75e"
        accentBg="linear-gradient(135deg, #f6f1e7 0%, #fdf8f0 100%)"
        orders={currentOrders}
        language={language}
        productMap={productMap}
        pickupDays={pickupDays}
        locationMap={locationMap}
        getLabel={getLabel}
        onNavigate={onNavigate}
        onCancelRequest={onCancelRequest}
        emptyMessage={emptyCurrentMsg}
        sort={currentSort}
        onSortChange={setCurrentSort}
        sortOptions={sortOptions}
        sortLabel={sortLabel}
      />

      <OrderColumn
        title={pastTitle}
        icon={<Zap className="w-4 h-4 text-stone-400" />}
        accent="#78716c"
        accentBg="linear-gradient(135deg, #f5f5f4 0%, #fafaf9 100%)"
        orders={pastOrders}
        language={language}
        productMap={productMap}
        pickupDays={pickupDays}
        locationMap={locationMap}
        getLabel={getLabel}
        onNavigate={onNavigate}
        onCancelRequest={onCancelRequest}
        emptyMessage={emptyPastMsg}
        sort={pastSort}
        onSortChange={setPastSort}
        sortOptions={sortOptions}
        sortLabel={sortLabel}
      />
    </div>
  );
}
