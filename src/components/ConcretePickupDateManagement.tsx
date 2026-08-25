import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Edit3, RefreshCw, Save, ShieldCheck, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PickupScheduleRow {
  id: string;
  schedule_key: string;
  label_en: string;
  is_active: boolean;
  sort_order: number;
}

interface PickupDateRow {
  id: string;
  schedule_id: string;
  pickup_date: string;
  order_cutoff_at: string;
  cancellation_cutoff_at: string;
  status: 'open' | 'closed' | 'sold_out';
  note_en: string | null;
  note_th: string | null;
  note_zh: string | null;
  source: 'generated' | 'manual' | 'legacy_override';
}

interface PickupDateLocationRow {
  pickup_date_id: string;
  location_id: string;
  is_active: boolean;
  sort_order: number;
  note_en: string | null;
}

interface PickupLocationRow {
  id: string;
  name_en: string;
  name_th: string | null;
  is_active: boolean;
  sort_order: number;
}

interface DateDraft {
  id: string;
  pickupDate: string;
  status: PickupDateRow['status'];
  orderCutoffDate: string;
  orderCutoffTime: string;
  sameCancellationCutoff: boolean;
  cancellationCutoffDate: string;
  cancellationCutoffTime: string;
  noteEn: string;
  noteTh: string;
  noteZh: string;
}

function bangkokToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateValue: string, days: number): string {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function dayDifference(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endUtc - startUtc) / 86_400_000);
}

function toBangkokInput(value: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function bangkokInputToIso(dateValue: string, timeValue: string): string {
  return new Date(`${dateValue}T${timeValue}:00+07:00`).toISOString();
}

function formatBangkokDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
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

export function ConcretePickupDateManagement() {
  const initialStart = useMemo(() => bangkokToday(), []);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(addDays(initialStart, 56));
  const [schedules, setSchedules] = useState<PickupScheduleRow[]>([]);
  const [dates, setDates] = useState<PickupDateRow[]>([]);
  const [dateLocations, setDateLocations] = useState<PickupDateLocationRow[]>([]);
  const [locations, setLocations] = useState<PickupLocationRow[]>([]);
  const [draft, setDraft] = useState<DateDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [materializing, setMaterializing] = useState(false);
  const [locationSavingKey, setLocationSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const scheduleById = useMemo(() => {
    const map = new Map<string, PickupScheduleRow>();
    schedules.forEach((schedule) => map.set(schedule.id, schedule));
    return map;
  }, [schedules]);

  const locationById = useMemo(() => {
    const map = new Map<string, PickupLocationRow>();
    locations.forEach((location) => map.set(location.id, location));
    return map;
  }, [locations]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    const [datesResult, schedulesResult, locationsResult] = await Promise.all([
      supabase
        .from('pickup_dates')
        .select('id, schedule_id, pickup_date, order_cutoff_at, cancellation_cutoff_at, status, note_en, note_th, note_zh, source')
        .gte('pickup_date', startDate)
        .lte('pickup_date', endDate)
        .order('pickup_date', { ascending: true }),
      supabase
        .from('pickup_schedules')
        .select('id, schedule_key, label_en, is_active, sort_order')
        .order('sort_order', { ascending: true }),
      supabase
        .from('cms_pickup_locations')
        .select('id, name_en, name_th, is_active, sort_order')
        .order('sort_order', { ascending: true }),
    ]);

    const firstError = datesResult.error || schedulesResult.error || locationsResult.error;
    if (firstError) {
      console.error('Error loading concrete pickup dates:', firstError);
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const loadedDates = (datesResult.data || []) as PickupDateRow[];
    let loadedDateLocations: PickupDateLocationRow[] = [];

    if (loadedDates.length > 0) {
      const dateLocationResult = await supabase
        .from('pickup_date_locations')
        .select('pickup_date_id, location_id, is_active, sort_order, note_en')
        .in('pickup_date_id', loadedDates.map((date) => date.id))
        .order('sort_order', { ascending: true });

      if (dateLocationResult.error) {
        console.error('Error loading pickup date locations:', dateLocationResult.error);
        setError(dateLocationResult.error.message);
        setLoading(false);
        return;
      }
      loadedDateLocations = (dateLocationResult.data || []) as PickupDateLocationRow[];
    }

    setDates(loadedDates);
    setSchedules((schedulesResult.data || []) as PickupScheduleRow[]);
    setLocations((locationsResult.data || []) as PickupLocationRow[]);
    setDateLocations(loadedDateLocations);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleRefresh = async () => {
    setNotice('');
    await loadData();
  };

  const validateRange = (): string | null => {
    if (!startDate || !endDate) return 'Start and end dates are required.';
    if (endDate < startDate) return 'End date must be on or after start date.';
    if (dayDifference(startDate, endDate) >= 366) return 'Materialization is limited to 366 days per operation.';
    if (startDate < initialStart) return 'The Admin materializer does not create past pickup dates. Use a reviewed reconciliation workflow for historical data.';
    return null;
  };

  const handleMaterialize = async () => {
    if (materializing) return;
    const rangeError = validateRange();
    if (rangeError) {
      setError(rangeError);
      return;
    }

    const confirmed = window.confirm(
      `Materialize pickup dates from ${startDate} through ${endDate}?\n\n` +
      'This writes live v2 pickup-date records for active recurring schedules. Existing manual date overrides are preserved.'
    );
    if (!confirmed) return;

    setMaterializing(true);
    setError('');
    setNotice('');
    try {
      const { data, error: materializeError } = await supabase.rpc('materialize_pickup_dates_v2', {
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (materializeError) throw materializeError;

      const inserted = typeof data === 'number' ? data : Number(data || 0);
      setNotice(`Pickup-date materialization complete. ${inserted} new date${inserted === 1 ? '' : 's'} created.`);
      await loadData();
    } catch (err) {
      console.error('Error materializing pickup dates:', err);
      setError(err instanceof Error ? err.message : 'Could not materialize pickup dates.');
    } finally {
      setMaterializing(false);
    }
  };

  const startEdit = (pickupDate: PickupDateRow) => {
    const orderCutoff = toBangkokInput(pickupDate.order_cutoff_at);
    const cancellationCutoff = toBangkokInput(pickupDate.cancellation_cutoff_at);

    setError('');
    setNotice('');
    setDraft({
      id: pickupDate.id,
      pickupDate: pickupDate.pickup_date,
      status: pickupDate.status,
      orderCutoffDate: orderCutoff.date,
      orderCutoffTime: orderCutoff.time,
      sameCancellationCutoff: orderCutoff.date === cancellationCutoff.date && orderCutoff.time === cancellationCutoff.time,
      cancellationCutoffDate: cancellationCutoff.date,
      cancellationCutoffTime: cancellationCutoff.time,
      noteEn: pickupDate.note_en || '',
      noteTh: pickupDate.note_th || '',
      noteZh: pickupDate.note_zh || '',
    });
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || saving) return;

    const currentActiveLocations = dateLocations.filter((link) => link.pickup_date_id === draft.id && link.is_active);
    if (draft.status === 'open' && currentActiveLocations.length === 0) {
      setError('An open pickup date needs at least one active pickup location. Add a location before reopening this date.');
      return;
    }

    const confirmed = window.confirm(
      `Save date settings for ${draft.pickupDate}?\n\n` +
      'This changes the live concrete v2 pickup-date snapshot. Existing orders keep their pickup-date identity.'
    );
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const orderCutoffAt = bangkokInputToIso(draft.orderCutoffDate, draft.orderCutoffTime);
      const cancellationCutoffAt = draft.sameCancellationCutoff
        ? orderCutoffAt
        : bangkokInputToIso(draft.cancellationCutoffDate, draft.cancellationCutoffTime);

      const { error: dateError } = await supabase.rpc('admin_update_pickup_date_v2', {
        p_pickup_date_id: draft.id,
        p_status: draft.status,
        p_order_cutoff_at: orderCutoffAt,
        p_cancellation_cutoff_at: cancellationCutoffAt,
        p_note_en: draft.noteEn.trim() || null,
        p_note_th: draft.noteTh.trim() || null,
        p_note_zh: draft.noteZh.trim() || null,
      });
      if (dateError) throw dateError;

      setDraft(null);
      setNotice(`Pickup date ${draft.pickupDate} updated.`);
      await loadData();
    } catch (err) {
      console.error('Error updating concrete pickup date:', err);
      setError(err instanceof Error ? err.message : 'Could not update pickup date.');
    } finally {
      setSaving(false);
    }
  };

  const handleLocationToggle = async (pickupDate: PickupDateRow, location: PickupLocationRow, desiredActive: boolean) => {
    const key = `${pickupDate.id}:${location.id}`;
    if (locationSavingKey) return;

    if (desiredActive && !location.is_active) {
      setError('Reactivate this pickup location globally before enabling it for a concrete date.');
      return;
    }

    const currentActiveLinks = dateLocations.filter((link) => link.pickup_date_id === pickupDate.id && link.is_active);
    if (!desiredActive && pickupDate.status === 'open' && currentActiveLinks.length <= 1) {
      setError('An open pickup date must keep at least one active location. Close the date first or enable another location.');
      return;
    }

    const confirmed = window.confirm(
      `${desiredActive ? 'Enable' : 'Disable'} ${location.name_en} for ${pickupDate.pickup_date}?\n\n` +
      'This is a live concrete-date location change.'
    );
    if (!confirmed) return;

    setLocationSavingKey(key);
    setError('');
    setNotice('');
    try {
      const { error: locationError } = await supabase.rpc('admin_set_pickup_date_location_v2', {
        p_pickup_date_id: pickupDate.id,
        p_location_id: location.id,
        p_is_active: desiredActive,
        p_note_en: null,
      });
      if (locationError) throw locationError;

      setNotice(`${location.name_en} ${desiredActive ? 'enabled' : 'disabled'} for ${pickupDate.pickup_date}.`);
      await loadData();
    } catch (err) {
      console.error('Error updating pickup-date location:', err);
      setError(err instanceof Error ? err.message : 'Could not update pickup-date location.');
    } finally {
      setLocationSavingKey(null);
    }
  };

  const editedPickupDate = draft ? dates.find((date) => date.id === draft.id) || null : null;

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Concrete Pickup Dates</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Materialize future dates from active recurring schedules, then manage date-specific status, cutoffs, locations and notes without rewriting the recurring template.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={loading || saving || materializing || Boolean(locationSavingKey)}
          className="inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-950 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Recurring rules and concrete dates are separate on purpose.</p>
          <p className="mt-1 leading-relaxed">
            Materialization creates only missing dates for currently active schedules. Date settings and each date-location change are saved as separate admin-only RPC actions so a failed action cannot partially apply several unrelated changes.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900">Materialize / extend calendar</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          The default view is eight weeks, but the range is editable. Only active recurring schedules produce dates; manual concrete-date overrides are preserved.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Start date</span>
            <input
              type="date"
              value={startDate}
              min={initialStart}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">End date</span>
            <input
              type="date"
              value={endDate}
              min={startDate || initialStart}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleMaterialize()}
            disabled={materializing || loading || !startDate || !endDate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            <CalendarDays className="w-4 h-4" />
            {materializing ? 'Materializing…' : 'Materialize Dates'}
          </button>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading || materializing}
            className="text-xs text-primary-700 hover:text-primary-800 font-medium"
          >
            Apply range to list / refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>
      )}

      {draft && editedPickupDate && (
        <form onSubmit={handleSave} className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900">Edit {formatPickupDate(draft.pickupDate)}</h3>
              <p className="text-xs text-gray-500 mt-1">Date settings save atomically through `admin_update_pickup_date_v2`.</p>
            </div>
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={saving}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-white rounded-lg disabled:opacity-50"
              aria-label="Close pickup-date editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Status</span>
              <select
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value as PickupDateRow['status'] })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="sold_out">Sold out</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Order cutoff date</span>
              <input
                type="date"
                value={draft.orderCutoffDate}
                onChange={(event) => setDraft({ ...draft, orderCutoffDate: event.target.value })}
                required
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Order cutoff time</span>
              <input
                type="time"
                value={draft.orderCutoffTime}
                onChange={(event) => setDraft({ ...draft, orderCutoffTime: event.target.value })}
                required
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </label>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.sameCancellationCutoff}
                onChange={(event) => setDraft({ ...draft, sameCancellationCutoff: event.target.checked })}
                className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>
                <span className="block text-sm font-medium text-gray-800">Cancellation cutoff = order cutoff</span>
                <span className="block text-xs text-gray-500 mt-0.5">Keeps the approved default while still allowing a one-off date exception when needed.</span>
              </span>
            </label>
            {!draft.sameCancellationCutoff && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Cancellation cutoff date</span>
                  <input
                    type="date"
                    value={draft.cancellationCutoffDate}
                    onChange={(event) => setDraft({ ...draft, cancellationCutoffDate: event.target.value })}
                    required
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Cancellation cutoff time</span>
                  <input
                    type="time"
                    value={draft.cancellationCutoffTime}
                    onChange={(event) => setDraft({ ...draft, cancellationCutoffTime: event.target.value })}
                    required
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3">
              <span className="text-sm font-medium text-gray-700">Pickup locations for this date</span>
              <p className="text-xs text-gray-500 mt-0.5">Location toggles save immediately as separate atomic Admin actions.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {locations.map((location) => {
                const link = dateLocations.find((item) => item.pickup_date_id === draft.id && item.location_id === location.id);
                const checked = Boolean(link?.is_active);
                const savingKey = `${draft.id}:${location.id}`;
                return (
                  <label key={location.id} className={`flex items-start gap-3 rounded-lg border px-3 py-3 ${checked ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-white'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={Boolean(locationSavingKey) || saving}
                      onChange={(event) => void handleLocationToggle(editedPickupDate, location, event.target.checked)}
                      className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-800">
                      <span className="font-medium">{location.name_en}</span>
                      {!location.is_active && <span className="ml-2 text-xs text-amber-700">location inactive</span>}
                      {locationSavingKey === savingKey && <span className="ml-2 text-xs text-gray-500">saving…</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Note (English)</span>
              <input
                type="text"
                value={draft.noteEn}
                onChange={(event) => setDraft({ ...draft, noteEn: event.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Note (Thai)</span>
              <input
                type="text"
                value={draft.noteTh}
                onChange={(event) => setDraft({ ...draft, noteTh: event.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Note (Chinese)</span>
              <input
                type="text"
                value={draft.noteZh}
                onChange={(event) => setDraft({ ...draft, noteZh: event.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || Boolean(locationSavingKey)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Date Settings'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Pickup date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Schedule</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Location(s)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Order cutoff</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Cancellation cutoff</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">Loading pickup dates…</td></tr>
            ) : dates.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">
                  <CalendarDays className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                  No concrete pickup dates in this range.
                </td>
              </tr>
            ) : dates.map((pickupDate) => {
              const schedule = scheduleById.get(pickupDate.schedule_id);
              const linkedLocations = dateLocations
                .filter((link) => link.pickup_date_id === pickupDate.id && link.is_active)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((link) => locationById.get(link.location_id))
                .filter((location): location is PickupLocationRow => Boolean(location));
              const statusClass = pickupDate.status === 'open'
                ? 'bg-green-100 text-green-700'
                : pickupDate.status === 'sold_out'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700';

              return (
                <tr key={pickupDate.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-sm">{formatPickupDate(pickupDate.pickup_date)}</p>
                    <p className="text-xs text-gray-500">{pickupDate.source === 'manual' ? 'Manual override' : pickupDate.source === 'legacy_override' ? 'Legacy override' : 'Generated'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div>{schedule?.label_en || 'Unknown schedule'}</div>
                    <div className="text-xs text-gray-400 font-mono">{schedule?.schedule_key}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {linkedLocations.length > 0
                      ? linkedLocations.map((location) => <div key={location.id}>{location.name_en}{!location.is_active ? ' (inactive)' : ''}</div>)
                      : <span className="text-red-600">No active location</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">{formatBangkokDateTime(pickupDate.order_cutoff_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{formatBangkokDateTime(pickupDate.cancellation_cutoff_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusClass}`}>
                      {pickupDate.status === 'sold_out' ? 'Sold out' : pickupDate.status.charAt(0).toUpperCase() + pickupDate.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(pickupDate)}
                      disabled={saving || materializing || Boolean(locationSavingKey)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50 rounded-lg disabled:opacity-50"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
        Product capacity overrides remain a separate product/inventory Admin workflow and are not changed from this screen. Customer v2 ordering remains disabled until the separately reviewed frontend cutover.
      </div>
    </div>
  );
}
