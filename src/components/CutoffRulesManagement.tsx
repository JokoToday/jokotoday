import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Edit3, Plus, RefreshCw, Save, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CutoffRulesManagementProps {
  onRefresh: () => void;
}

interface PickupScheduleRow {
  id: string;
  schedule_key: string;
  label_en: string;
  label_th: string | null;
  label_zh: string | null;
  pickup_weekday: number;
  order_cutoff_days_before: number;
  order_cutoff_time: string;
  cancellation_cutoff_days_before: number;
  cancellation_cutoff_time: string;
  is_active: boolean;
  sort_order: number;
}

interface PickupScheduleLocationRow {
  schedule_id: string;
  location_id: string;
  is_active: boolean;
  sort_order: number;
}

interface PickupLocationRow {
  id: string;
  name_en: string;
  name_th: string | null;
  name_zh: string | null;
  is_active: boolean;
  sort_order: number;
}

interface ScheduleDraft {
  id: string | null;
  scheduleKey: string;
  labelEn: string;
  labelTh: string;
  labelZh: string;
  pickupWeekday: number;
  orderCutoffDaysBefore: number;
  orderCutoffTime: string;
  sameCancellationCutoff: boolean;
  cancellationCutoffDaysBefore: number;
  cancellationCutoffTime: string;
  locationIds: string[];
  isActive: boolean;
  sortOrder: number;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function normalizeTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '17:00';
}

function buildScheduleKey(label: string, weekday: number): string {
  const labelPart = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const dayPart = WEEKDAYS[weekday]?.toLowerCase() || 'pickup';

  if (!labelPart) return `${dayPart}_pickup`;
  return labelPart.startsWith(dayPart) ? labelPart : `${dayPart}_${labelPart}`;
}

function blankDraft(sortOrder: number): ScheduleDraft {
  return {
    id: null,
    scheduleKey: '',
    labelEn: '',
    labelTh: '',
    labelZh: '',
    pickupWeekday: 6,
    orderCutoffDaysBefore: 2,
    orderCutoffTime: '17:00',
    sameCancellationCutoff: true,
    cancellationCutoffDaysBefore: 2,
    cancellationCutoffTime: '17:00',
    locationIds: [],
    isActive: false,
    sortOrder,
  };
}

export function CutoffRulesManagement({ onRefresh }: CutoffRulesManagementProps) {
  const [schedules, setSchedules] = useState<PickupScheduleRow[]>([]);
  const [scheduleLocations, setScheduleLocations] = useState<PickupScheduleLocationRow[]>([]);
  const [locations, setLocations] = useState<PickupLocationRow[]>([]);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const locationById = useMemo(() => {
    const map = new Map<string, PickupLocationRow>();
    locations.forEach((location) => map.set(location.id, location));
    return map;
  }, [locations]);

  const loadScheduleData = async () => {
    setLoading(true);
    setError('');

    const [schedulesResult, scheduleLocationsResult, locationsResult] = await Promise.all([
      supabase
        .from('pickup_schedules')
        .select('id, schedule_key, label_en, label_th, label_zh, pickup_weekday, order_cutoff_days_before, order_cutoff_time, cancellation_cutoff_days_before, cancellation_cutoff_time, is_active, sort_order')
        .order('sort_order', { ascending: true }),
      supabase
        .from('pickup_schedule_locations')
        .select('schedule_id, location_id, is_active, sort_order')
        .order('sort_order', { ascending: true }),
      supabase
        .from('cms_pickup_locations')
        .select('id, name_en, name_th, name_zh, is_active, sort_order')
        .order('sort_order', { ascending: true }),
    ]);

    const firstError = schedulesResult.error || scheduleLocationsResult.error || locationsResult.error;
    if (firstError) {
      console.error('Error loading v2 pickup schedules:', firstError);
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setSchedules((schedulesResult.data || []) as PickupScheduleRow[]);
    setScheduleLocations((scheduleLocationsResult.data || []) as PickupScheduleLocationRow[]);
    setLocations((locationsResult.data || []) as PickupLocationRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadScheduleData();
  }, []);

  const handleRefresh = async () => {
    setNotice('');
    await loadScheduleData();
    onRefresh();
  };

  const startEdit = (schedule: PickupScheduleRow) => {
    const linkedLocationIds = scheduleLocations
      .filter((link) => link.schedule_id === schedule.id && link.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((link) => link.location_id);
    const sameCancellationCutoff = schedule.order_cutoff_days_before === schedule.cancellation_cutoff_days_before
      && normalizeTime(schedule.order_cutoff_time) === normalizeTime(schedule.cancellation_cutoff_time);

    setError('');
    setNotice('');
    setDraft({
      id: schedule.id,
      scheduleKey: schedule.schedule_key,
      labelEn: schedule.label_en,
      labelTh: schedule.label_th || '',
      labelZh: schedule.label_zh || '',
      pickupWeekday: schedule.pickup_weekday,
      orderCutoffDaysBefore: schedule.order_cutoff_days_before,
      orderCutoffTime: normalizeTime(schedule.order_cutoff_time),
      sameCancellationCutoff,
      cancellationCutoffDaysBefore: schedule.cancellation_cutoff_days_before,
      cancellationCutoffTime: normalizeTime(schedule.cancellation_cutoff_time),
      locationIds: linkedLocationIds,
      isActive: schedule.is_active,
      sortOrder: schedule.sort_order,
    });
  };

  const startCreate = () => {
    const nextSortOrder = schedules.length > 0
      ? Math.max(...schedules.map((schedule) => schedule.sort_order)) + 10
      : 10;
    setError('');
    setNotice('');
    setDraft(blankDraft(nextSortOrder));
  };

  const toggleLocation = (locationId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const hasLocation = current.locationIds.includes(locationId);
      return {
        ...current,
        locationIds: hasLocation
          ? current.locationIds.filter((id) => id !== locationId)
          : [...current.locationIds, locationId],
      };
    });
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || saving) return;

    setError('');
    setNotice('');

    const labelEn = draft.labelEn.trim();
    if (!labelEn) {
      setError('English schedule label is required.');
      return;
    }
    if (draft.locationIds.length === 0) {
      setError('Select at least one pickup location.');
      return;
    }
    if (draft.isActive) {
      const activeSelectedLocation = draft.locationIds.some((id) => locationById.get(id)?.is_active);
      if (!activeSelectedLocation) {
        setError('An active pickup schedule needs at least one active pickup location.');
        return;
      }
    }

    const scheduleKey = draft.id
      ? draft.scheduleKey
      : buildScheduleKey(labelEn, draft.pickupWeekday);
    const cancellationDaysBefore = draft.sameCancellationCutoff
      ? draft.orderCutoffDaysBefore
      : draft.cancellationCutoffDaysBefore;
    const cancellationTime = draft.sameCancellationCutoff
      ? draft.orderCutoffTime
      : draft.cancellationCutoffTime;

    setSaving(true);
    try {
      const { error: saveError } = await supabase.rpc('admin_upsert_pickup_schedule_v2', {
        p_schedule_id: draft.id,
        p_schedule_key: scheduleKey,
        p_label_en: labelEn,
        p_label_th: draft.labelTh.trim() || null,
        p_label_zh: draft.labelZh.trim() || null,
        p_pickup_weekday: draft.pickupWeekday,
        p_order_cutoff_days_before: draft.orderCutoffDaysBefore,
        p_order_cutoff_time: draft.orderCutoffTime,
        p_cancellation_cutoff_days_before: cancellationDaysBefore,
        p_cancellation_cutoff_time: cancellationTime,
        p_location_ids: draft.locationIds,
        p_is_active: draft.isActive,
        p_sort_order: draft.sortOrder,
      });

      if (saveError) throw saveError;

      setDraft(null);
      setNotice(draft.id ? 'Pickup schedule updated.' : 'Pickup schedule created.');
      await loadScheduleData();
      onRefresh();
    } catch (err) {
      console.error('Error saving v2 pickup schedule:', err);
      setError(err instanceof Error ? err.message : 'Could not save pickup schedule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Pickup Schedule</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Manage recurring pickup days, locations and cutoffs. These are business settings stored in the v2 schedule model, not hard-coded application rules.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading || saving}
            className="inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={startCreate}
            disabled={loading || saving || locations.length === 0}
            className="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Schedule
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-950 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Recurring rules are editable; concrete pickup dates remain stable snapshots.</p>
          <p className="mt-1 leading-relaxed">
            Schedule changes are saved transactionally through the admin-only v2 RPC. Existing materialized dates and orders are not silently rewritten. Date-specific exceptions belong in the concrete-date controls.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      {draft && (
        <form onSubmit={handleSave} className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900">{draft.id ? 'Edit Pickup Schedule' : 'Add Pickup Schedule'}</h3>
              {draft.id && <p className="text-xs text-gray-500 mt-1 font-mono">{draft.scheduleKey}</p>}
            </div>
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={saving}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-white rounded-lg disabled:opacity-50"
              aria-label="Close schedule editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Label (English)</span>
              <input
                type="text"
                value={draft.labelEn}
                onChange={(event) => setDraft({ ...draft, labelEn: event.target.value })}
                required
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="Saturday – Mae Rim"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Label (Thai)</span>
              <input
                type="text"
                value={draft.labelTh}
                onChange={(event) => setDraft({ ...draft, labelTh: event.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Label (Chinese)</span>
              <input
                type="text"
                value={draft.labelZh}
                onChange={(event) => setDraft({ ...draft, labelZh: event.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Pickup weekday</span>
              <select
                value={draft.pickupWeekday}
                onChange={(event) => setDraft({ ...draft, pickupWeekday: Number(event.target.value) })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                {WEEKDAYS.map((weekday, index) => <option key={weekday} value={index}>{weekday}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Order cutoff — days before pickup</span>
              <select
                value={draft.orderCutoffDaysBefore}
                onChange={(event) => setDraft({ ...draft, orderCutoffDaysBefore: Number(event.target.value) })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                {[0, 1, 2, 3, 4, 5, 6].map((days) => <option key={days} value={days}>{days}</option>)}
              </select>
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
                <span className="block text-xs text-gray-500 mt-0.5">Recommended default. Turn this off only if the business needs a different self-cancellation window.</span>
              </span>
            </label>

            {!draft.sameCancellationCutoff && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Cancellation cutoff — days before pickup</span>
                  <select
                    value={draft.cancellationCutoffDaysBefore}
                    onChange={(event) => setDraft({ ...draft, cancellationCutoffDaysBefore: Number(event.target.value) })}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((days) => <option key={days} value={days}>{days}</option>)}
                  </select>
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

          <div>
            <span className="text-sm font-medium text-gray-700">Pickup locations</span>
            <p className="text-xs text-gray-500 mt-0.5">One recurring schedule may offer more than one location. Inventory remains shared by pickup date.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
              {locations.map((location) => (
                <label key={location.id} className={`flex items-start gap-3 rounded-lg border px-3 py-3 cursor-pointer ${draft.locationIds.includes(location.id) ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-white'}`}>
                  <input
                    type="checkbox"
                    checked={draft.locationIds.includes(location.id)}
                    onChange={() => toggleLocation(location.id)}
                    className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-800">
                    <span className="font-medium">{location.name_en}</span>
                    {!location.is_active && <span className="ml-2 text-xs text-amber-700">location inactive</span>}
                  </span>
                </label>
              ))}
            </div>
            {locations.length === 0 && <p className="text-sm text-red-600 mt-2">Create a pickup location before creating a schedule.</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>
                <span className="block text-sm font-medium text-gray-800">Active recurring schedule</span>
                <span className="block text-xs text-gray-500">Only active schedules are materialized into future pickup dates.</span>
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Sort order</span>
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) || 0 })}
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
              disabled={saving || locations.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Schedule</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Weekday</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Location(s)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Order cutoff</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Cancellation cutoff</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">Loading schedules…</td></tr>
            ) : schedules.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">
                  <CalendarDays className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                  No v2 pickup schedules configured.
                </td>
              </tr>
            ) : schedules.map((schedule) => {
              const linkedLocations = scheduleLocations
                .filter((link) => link.schedule_id === schedule.id && link.is_active)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((link) => locationById.get(link.location_id))
                .filter((location): location is PickupLocationRow => Boolean(location));
              const sameCutoff = schedule.order_cutoff_days_before === schedule.cancellation_cutoff_days_before
                && normalizeTime(schedule.order_cutoff_time) === normalizeTime(schedule.cancellation_cutoff_time);

              return (
                <tr key={schedule.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-sm">{schedule.label_en}</p>
                    <p className="text-xs text-gray-500 font-mono">{schedule.schedule_key}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{WEEKDAYS[schedule.pickup_weekday] || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {linkedLocations.length > 0 ? linkedLocations.map((location) => (
                      <div key={location.id}>{location.name_en}{!location.is_active ? ' (inactive)' : ''}</div>
                    )) : <span className="text-red-600">No location</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {schedule.order_cutoff_days_before}d before · {normalizeTime(schedule.order_cutoff_time)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {sameCutoff
                      ? <span className="text-green-700">Same as order cutoff</span>
                      : `${schedule.cancellation_cutoff_days_before}d before · ${normalizeTime(schedule.cancellation_cutoff_time)}`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${schedule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {schedule.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(schedule)}
                      disabled={saving}
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
        Changing recurring configuration affects future materialization. Once concrete dates exist, the database deliberately blocks changing that schedule's weekday; use date overrides or create a new recurring schedule instead.
      </div>
    </div>
  );
}
