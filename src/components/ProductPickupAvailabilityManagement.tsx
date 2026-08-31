import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, PackageCheck, RefreshCw, Save, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProductRow {
  id: string;
  name_en: string;
  name_th: string;
  name_zh: string | null;
  is_active: boolean;
  sort_order: number;
}

interface PickupScheduleRow {
  id: string;
  schedule_key: string;
  label_en: string;
  label_th: string | null;
  label_zh: string | null;
  is_active: boolean;
  sort_order: number;
}

interface ProductScheduleCapacityRow {
  schedule_id: string;
  product_id: string;
  capacity: number;
  is_active: boolean;
  updated_at: string;
}

interface PickupDateRow {
  id: string;
  schedule_id: string;
  pickup_date: string;
  status: 'open' | 'closed' | 'sold_out';
}

interface ProductDateInventoryRow {
  pickup_date_id: string;
  product_id: string;
  capacity: number;
  reserved_quantity: number;
  capacity_source: 'recurring_default' | 'date_override' | string;
  override_note: string | null;
}

interface DateOverrideDraft {
  capacity: string;
  note: string;
}

function bangkokToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatPickupDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00+07:00`));
}

function keyFor(productId: string, scheduleId: string): string {
  return `${productId}:${scheduleId}`;
}

export function ProductPickupAvailabilityManagement() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [schedules, setSchedules] = useState<PickupScheduleRow[]>([]);
  const [capacities, setCapacities] = useState<ProductScheduleCapacityRow[]>([]);
  const [pickupDates, setPickupDates] = useState<PickupDateRow[]>([]);
  const [dateInventory, setDateInventory] = useState<ProductDateInventoryRow[]>([]);
  const [capacityDrafts, setCapacityDrafts] = useState<Record<string, string>>({});
  const [dateOverrideDrafts, setDateOverrideDrafts] = useState<Record<string, DateOverrideDraft>>({});
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const capacityByKey = useMemo(() => {
    const map = new Map<string, ProductScheduleCapacityRow>();
    capacities.forEach((row) => map.set(keyFor(row.product_id, row.schedule_id), row));
    return map;
  }, [capacities]);

  const scheduleById = useMemo(() => {
    const map = new Map<string, PickupScheduleRow>();
    schedules.forEach((row) => map.set(row.id, row));
    return map;
  }, [schedules]);

  const dateInventoryByKey = useMemo(() => {
    const map = new Map<string, ProductDateInventoryRow>();
    dateInventory.forEach((row) => map.set(`${row.product_id}:${row.pickup_date_id}`, row));
    return map;
  }, [dateInventory]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => [product.name_en, product.name_th, product.name_zh || '']
      .some((value) => value.toLowerCase().includes(query)));
  }, [products, search]);

  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;

  const selectedProductDates = useMemo(() => {
    if (!selectedProductId) return [];
    return pickupDates.filter((pickupDate) => {
      const recurring = capacityByKey.get(keyFor(selectedProductId, pickupDate.schedule_id));
      const inventory = dateInventoryByKey.get(`${selectedProductId}:${pickupDate.id}`);
      return Boolean(recurring || inventory);
    });
  }, [pickupDates, selectedProductId, capacityByKey, dateInventoryByKey]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    const today = bangkokToday();

    const [productsResult, schedulesResult, capacitiesResult, datesResult, inventoryResult] = await Promise.all([
      supabase
        .from('cms_products')
        .select('id, name_en, name_th, name_zh, is_active, sort_order')
        .order('sort_order', { ascending: true }),
      supabase
        .from('pickup_schedules')
        .select('id, schedule_key, label_en, label_th, label_zh, is_active, sort_order')
        .order('sort_order', { ascending: true }),
      supabase
        .from('product_schedule_capacity')
        .select('schedule_id, product_id, capacity, is_active, updated_at'),
      supabase
        .from('pickup_dates')
        .select('id, schedule_id, pickup_date, status')
        .gte('pickup_date', today)
        .order('pickup_date', { ascending: true }),
      supabase
        .from('product_date_inventory')
        .select('pickup_date_id, product_id, capacity, reserved_quantity, capacity_source, override_note'),
    ]);

    const firstError = productsResult.error
      || schedulesResult.error
      || capacitiesResult.error
      || datesResult.error
      || inventoryResult.error;

    if (firstError) {
      console.error('Error loading Pickup v2 product configuration:', firstError);
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const loadedProducts = (productsResult.data || []) as ProductRow[];
    const loadedCapacities = (capacitiesResult.data || []) as ProductScheduleCapacityRow[];
    const loadedInventory = (inventoryResult.data || []) as ProductDateInventoryRow[];

    setProducts(loadedProducts);
    setSchedules((schedulesResult.data || []) as PickupScheduleRow[]);
    setCapacities(loadedCapacities);
    setPickupDates((datesResult.data || []) as PickupDateRow[]);
    setDateInventory(loadedInventory);

    setCapacityDrafts(Object.fromEntries(
      loadedCapacities.map((row) => [keyFor(row.product_id, row.schedule_id), String(row.capacity)]),
    ));

    setDateOverrideDrafts(Object.fromEntries(
      loadedInventory
        .filter((row) => row.capacity_source === 'date_override')
        .map((row) => [`${row.product_id}:${row.pickup_date_id}`, {
          capacity: String(row.capacity),
          note: row.override_note || '',
        }]),
    ));

    setSelectedProductId((current) => current || loadedProducts[0]?.id || '');
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSaveCapacity = async (product: ProductRow, schedule: PickupScheduleRow) => {
    const key = keyFor(product.id, schedule.id);
    const parsedCapacity = Number(capacityDrafts[key]);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 0) {
      setError('Capacity must be a whole number of zero or greater.');
      return;
    }

    const existing = capacityByKey.get(key);
    const confirmed = window.confirm(
      `Save recurring capacity ${parsedCapacity} for ${product.name_en} on ${schedule.label_en}?\n\n`
      + 'This will also apply the recurring default to future materialized pickup dates while preserving explicit date overrides.',
    );
    if (!confirmed) return;

    setSavingKey(`capacity:${key}`);
    setError('');
    setNotice('');
    try {
      const { error: saveError } = await supabase.rpc('admin_set_product_schedule_capacity_v2', {
        p_schedule_id: schedule.id,
        p_product_id: product.id,
        p_capacity: parsedCapacity,
        p_apply_to_future_dates: true,
      });
      if (saveError) throw saveError;

      setNotice(`${product.name_en} · ${schedule.label_en}: recurring capacity saved.${existing?.is_active === false ? ' The product is now offered for this schedule because saving capacity activates the recurring row.' : ''}`);
      await loadData();
    } catch (err) {
      console.error('Error saving recurring Pickup v2 capacity:', err);
      setError(err instanceof Error ? err.message : 'Could not save recurring capacity.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleAvailabilityToggle = async (
    product: ProductRow,
    schedule: PickupScheduleRow,
    desiredActive: boolean,
  ) => {
    const key = keyFor(product.id, schedule.id);
    const existing = capacityByKey.get(key);
    if (!existing) {
      setError('Set and save a recurring capacity before changing product availability for this schedule.');
      return;
    }

    const confirmed = window.confirm(
      `${desiredActive ? 'Offer' : 'Stop offering'} ${product.name_en} on ${schedule.label_en}?\n\n`
      + (desiredActive
        ? 'Future recurring-default inventory rows will be restored to the configured capacity.'
        : 'Future recurring-default inventory will be reduced to already-reserved quantity, preventing new reservations without deleting history.'),
    );
    if (!confirmed) return;

    setSavingKey(`availability:${key}`);
    setError('');
    setNotice('');
    try {
      const { error: toggleError } = await supabase.rpc('admin_set_product_schedule_availability_v2', {
        p_schedule_id: schedule.id,
        p_product_id: product.id,
        p_is_active: desiredActive,
        p_apply_to_future_dates: true,
      });
      if (toggleError) throw toggleError;

      setNotice(`${product.name_en} is now ${desiredActive ? 'offered' : 'not offered'} on ${schedule.label_en}.`);
      await loadData();
    } catch (err) {
      console.error('Error changing recurring Pickup v2 availability:', err);
      setError(err instanceof Error ? err.message : 'Could not change product availability.');
    } finally {
      setSavingKey(null);
    }
  };

  const updateDateOverrideDraft = (key: string, next: Partial<DateOverrideDraft>) => {
    const currentInventory = dateInventoryByKey.get(key);
    setDateOverrideDrafts((current) => ({
      ...current,
      [key]: {
        capacity: current[key]?.capacity ?? String(currentInventory?.capacity ?? 0),
        note: current[key]?.note ?? currentInventory?.override_note ?? '',
        ...next,
      },
    }));
  };

  const handleSaveDateOverride = async (pickupDate: PickupDateRow) => {
    if (!selectedProduct) return;
    const key = `${selectedProduct.id}:${pickupDate.id}`;
    const inventory = dateInventoryByKey.get(key);
    const draft = dateOverrideDrafts[key] || {
      capacity: String(inventory?.capacity ?? 0),
      note: inventory?.override_note || '',
    };
    const parsedCapacity = Number(draft.capacity);

    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 0) {
      setError('Date capacity must be a whole number of zero or greater.');
      return;
    }
    if (inventory && parsedCapacity < inventory.reserved_quantity) {
      setError(`Capacity cannot be lower than the ${inventory.reserved_quantity} already reserved.`);
      return;
    }

    const confirmed = window.confirm(
      `Override ${selectedProduct.name_en} capacity to ${parsedCapacity} for ${formatPickupDate(pickupDate.pickup_date)}?\n\n`
      + 'This date becomes an explicit capacity override and will no longer be rewritten by recurring capacity changes.',
    );
    if (!confirmed) return;

    setSavingKey(`date:${key}`);
    setError('');
    setNotice('');
    try {
      const { error: saveError } = await supabase.rpc('admin_set_product_date_capacity_v2', {
        p_pickup_date_id: pickupDate.id,
        p_product_id: selectedProduct.id,
        p_capacity: parsedCapacity,
        p_note: draft.note.trim() || null,
      });
      if (saveError) throw saveError;

      setNotice(`${selectedProduct.name_en} · ${formatPickupDate(pickupDate.pickup_date)}: date override saved.`);
      await loadData();
    } catch (err) {
      console.error('Error saving Pickup v2 date capacity override:', err);
      setError(err instanceof Error ? err.message : 'Could not save date capacity override.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Product Pickup Availability & Capacity</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Configure which products are offered on each recurring Pickup v2 schedule, set shared date capacity defaults, and manage exceptional date-specific capacity overrides.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading || Boolean(savingKey)}
          className="inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-950 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Capacity and availability are saved as separate atomic Admin actions.</p>
          <p className="mt-1 leading-relaxed">
            Saving capacity creates or updates the recurring production rule and propagates it to future recurring-default inventory. Availability can then be switched off or on without deleting reservations or date overrides.
          </p>
        </div>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-primary-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Recurring product configuration</h3>
              <p className="text-xs text-gray-500 mt-0.5">Inventory is shared across all locations attached to the same concrete pickup date.</p>
            </div>
          </div>
          <label className="relative block sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </label>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">Loading Pickup v2 product configuration…</div>
        ) : schedules.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">No recurring pickup schedules exist yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-[220px]">Product</th>
                  {schedules.map((schedule) => (
                    <th key={schedule.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 min-w-[250px]">
                      <div>{schedule.label_en}</div>
                      <div className="mt-1 flex items-center gap-2 font-normal text-[11px] text-gray-500">
                        <span className="font-mono">{schedule.schedule_key}</span>
                        {!schedule.is_active && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-gray-600">schedule inactive</span>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100 align-top">
                    <td className="px-4 py-4 sticky left-0 bg-white z-10">
                      <p className="font-medium text-gray-900">{product.name_en}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{product.name_th}</p>
                      {!product.is_active && <span className="inline-block mt-2 rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">product inactive</span>}
                    </td>
                    {schedules.map((schedule) => {
                      const key = keyFor(product.id, schedule.id);
                      const current = capacityByKey.get(key);
                      const draftValue = capacityDrafts[key] ?? (current ? String(current.capacity) : '');
                      const capacitySaving = savingKey === `capacity:${key}`;
                      const availabilitySaving = savingKey === `availability:${key}`;

                      return (
                        <td key={schedule.id} className="px-4 py-4">
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                            <div>
                              <label className="text-xs font-medium text-gray-700">Shared capacity per date</label>
                              <div className="mt-1 flex gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={draftValue}
                                  onChange={(event) => setCapacityDrafts((currentDrafts) => ({ ...currentDrafts, [key]: event.target.value }))}
                                  placeholder="Not set"
                                  disabled={Boolean(savingKey)}
                                  className="min-w-0 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-60"
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleSaveCapacity(product, schedule)}
                                  disabled={Boolean(savingKey) || draftValue === ''}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  {capacitySaving ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
                              <div>
                                <p className="text-xs font-medium text-gray-700">Offered on this schedule</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">{current ? `Capacity ${current.capacity}` : 'Save capacity first'}</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={Boolean(current?.is_active)}
                                onClick={() => void handleAvailabilityToggle(product, schedule, !current?.is_active)}
                                disabled={Boolean(savingKey) || !current}
                                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${current?.is_active ? 'bg-green-600' : 'bg-gray-300'}`}
                              >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${current?.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                <span className="sr-only">{availabilitySaving ? 'Saving availability' : 'Toggle availability'}</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Concrete-date capacity overrides</h3>
              <p className="text-xs text-gray-500 mt-0.5">Use only for one-off production exceptions. Recurring defaults remain unchanged.</p>
            </div>
          </div>
          <label className="block mt-4 max-w-xl">
            <span className="text-sm font-medium text-gray-700">Product</span>
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              disabled={loading || Boolean(savingKey)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {products.map((product) => <option key={product.id} value={product.id}>{product.name_en} / {product.name_th}</option>)}
            </select>
          </label>
        </div>

        {!selectedProduct ? (
          <div className="py-10 text-center text-sm text-gray-500">Choose a product to manage concrete-date overrides.</div>
        ) : selectedProductDates.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            Configure recurring capacity for {selectedProduct.name_en} first; future dates will then appear here.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {selectedProductDates.map((pickupDate) => {
              const key = `${selectedProduct.id}:${pickupDate.id}`;
              const inventory = dateInventoryByKey.get(key);
              const recurring = capacityByKey.get(keyFor(selectedProduct.id, pickupDate.schedule_id));
              const schedule = scheduleById.get(pickupDate.schedule_id);
              const draft = dateOverrideDrafts[key] || {
                capacity: String(inventory?.capacity ?? recurring?.capacity ?? 0),
                note: inventory?.override_note || '',
              };
              const saving = savingKey === `date:${key}`;
              const remaining = inventory ? inventory.capacity - inventory.reserved_quantity : null;

              return (
                <div key={pickupDate.id} className="p-4 grid grid-cols-1 xl:grid-cols-[220px_170px_1fr_auto] gap-4 items-end">
                  <div>
                    <p className="font-medium text-gray-900">{formatPickupDate(pickupDate.pickup_date)}</p>
                    <p className="text-xs text-gray-500 mt-1">{schedule?.label_en || 'Unknown schedule'} · {pickupDate.status}</p>
                    {inventory && (
                      <p className="text-[11px] text-gray-500 mt-1">
                        {inventory.reserved_quantity} reserved · {remaining} remaining · {inventory.capacity_source === 'date_override' ? 'date override' : 'recurring default'}
                      </p>
                    )}
                  </div>
                  <label>
                    <span className="text-xs font-medium text-gray-700">Capacity</span>
                    <input
                      type="number"
                      min={inventory?.reserved_quantity ?? 0}
                      step="1"
                      value={draft.capacity}
                      onChange={(event) => updateDateOverrideDraft(key, { capacity: event.target.value })}
                      disabled={Boolean(savingKey)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-60"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-gray-700">Override note</span>
                    <input
                      type="text"
                      value={draft.note}
                      onChange={(event) => updateDateOverrideDraft(key, { note: event.target.value })}
                      placeholder="Optional reason"
                      disabled={Boolean(savingKey)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-60"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleSaveDateOverride(pickupDate)}
                    disabled={Boolean(savingKey) || draft.capacity === ''}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving…' : 'Save override'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
