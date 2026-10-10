import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generatePickupWindows, PickupWindowHours } from '../lib/pickupWindows';
import { getPickupWindowsRequired, setPickupWindowsRequired } from '../lib/pickupWindowService';

interface HoursRow extends PickupWindowHours {
  schedule_id?: string;
  pickup_date_id?: string;
  location_id: string;
  updated_at: string;
  is_active: boolean;
}

export function PickupHoursManagement({ scope }: { scope: 'schedule' | 'date' }) {
  const [rows, setRows] = useState<HoursRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [parents, setParents] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<HoursRow | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [required, setRequired] = useState(false);
  const [available, setAvailable] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [links, locations, parentRows] = await Promise.all([
        supabase.from(scope === 'schedule' ? 'pickup_schedule_locations' : 'pickup_date_locations')
          .select('*').eq('is_active', true),
        supabase.from('cms_pickup_locations').select('id,name_en'),
        scope === 'schedule' ? supabase.from('pickup_schedules').select('id,label_en')
          : supabase.from('pickup_dates').select('id,pickup_date').gte('pickup_date',
            new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())),
      ]);
      if (links.error || locations.error || parentRows.error) throw links.error || locations.error || parentRows.error;
      const supported = Boolean(links.data?.some((row) => 'pickup_open_time' in row));
      setAvailable(supported);
      const labels = Object.fromEntries((parentRows.data || []).map((row) => [row.id, 'label_en' in row ? row.label_en : row.pickup_date]));
      setParents(labels);
      setRows((links.data || []).filter((row) => labels[row.schedule_id || row.pickup_date_id]) as HoursRow[]);
      setNames(Object.fromEntries((locations.data || []).map((row) => [row.id, row.name_en])));
      setRequired(await getPickupWindowsRequired());
    } catch (err) {
      setError(err instanceof Error ? err.message : String((err as { message?: string })?.message || 'Could not load pickup hours'));
    } finally { setBusy(false); }
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!draft || !generatePickupWindows(draft).length) return;
    setBusy(true);
    setError('');
    try {
      const { error: saveError } = await supabase.rpc('admin_set_pickup_hours_v1', {
        p_scope: scope, p_parent_id: draft.schedule_id || draft.pickup_date_id,
        p_location_id: draft.location_id, p_open: draft.pickup_open_time,
        p_close: draft.pickup_close_time, p_minutes: draft.pickup_slot_minutes,
        p_expected_updated_at: draft.updated_at,
      });
      if (saveError) throw saveError;
      setDraft(null);
      setNotice('Pickup hours saved. Existing order windows are retained.');
      await load();
    } catch (err) {
      setError(String((err as { message?: string })?.message || 'Could not save pickup hours'));
    } finally { setBusy(false); }
  };

  const toggle = async () => {
    if (!window.confirm(required ? 'Stop requiring pickup windows for new online orders?'
      : 'Require an approximate pickup time for new online orders? Configure every future operation first. Older checkout screens will need to refresh.')) return;
    setBusy(true);
    setError('');
    try { await setPickupWindowsRequired(!required); await load(); }
    catch (err) { setError(String((err as { message?: string })?.message || 'Could not update rollout')); }
    finally { setBusy(false); }
  };

  const slots = draft ? generatePickupWindows(draft) : [];
  return <section className="mt-8 rounded-2xl border border-[#55766F]/20 bg-[#FFF9EE] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-lg font-semibold">{scope === 'schedule' ? 'Recurring pickup hours' : 'Concrete pickup hours'} · Bangkok</h3>
      <button type="button" onClick={() => void load()} disabled={busy} className="rounded-lg border px-3 py-2 disabled:opacity-50">Refresh hours</button>
    </div>
    <p className="mt-2 text-sm text-gray-600">{scope === 'schedule'
      ? 'Defaults copy only to newly created date/location operations. Existing dates keep their saved hours.'
      : 'Configure each date and location. Windows are approximate arrival times with no capacity limit. Configured operations with active orders keep their hours until the amendment workflow is available.'}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-green-800">{notice}</p>}
    {!busy && !available && <p className="mt-3 text-sm text-amber-800">Pickup hours become available after the database foundation is installed and active locations exist.</p>}
    {available && <div className="mt-4 space-y-3">
      {rows.map((row) => <div key={`${row.schedule_id || row.pickup_date_id}:${row.location_id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3">
        <div><p className="font-medium">{parents[row.schedule_id || row.pickup_date_id || '']} · {names[row.location_id]}</p>
          <p className="text-sm text-gray-600">{row.pickup_open_time ? `${row.pickup_open_time.slice(0, 5)}–${row.pickup_close_time?.slice(0, 5)} · ${row.pickup_slot_minutes} minutes` : 'Hours not configured'}</p></div>
        <button type="button" disabled={busy} onClick={() => setDraft({ ...row, pickup_open_time: row.pickup_open_time?.slice(0, 5) || '', pickup_close_time: row.pickup_close_time?.slice(0, 5) || '', pickup_slot_minutes: row.pickup_slot_minutes || 30 })} className="rounded-lg border px-3 py-2">Edit hours</button>
      </div>)}
      {draft && <div className="rounded-xl border border-[#55766F]/25 bg-[#CFE3DF]/30 p-4">
        <p className="mb-3 font-medium">{parents[draft.schedule_id || draft.pickup_date_id || '']} · {names[draft.location_id]}</p>
        <div className="flex flex-wrap gap-4">
          <label>Opens<input type="time" value={draft.pickup_open_time || ''} onChange={(e) => setDraft({ ...draft, pickup_open_time: e.target.value })} className="mt-1 block rounded border p-2" /></label>
          <label>Closes<input type="time" value={draft.pickup_close_time || ''} onChange={(e) => setDraft({ ...draft, pickup_close_time: e.target.value })} className="mt-1 block rounded border p-2" /></label>
          <label>Interval<select value={draft.pickup_slot_minutes || 30} onChange={(e) => setDraft({ ...draft, pickup_slot_minutes: Number(e.target.value) })} className="mt-1 block rounded border p-2">{[15, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
        </div>
        <p className="mt-3 text-sm">{slots.length ? `${slots.length} windows: ${slots.map((slot) => `${slot.start}–${slot.end}`).join(', ')}` : 'Choose same-day hours containing a whole number of intervals.'}</p>
        <div className="mt-3 flex gap-3"><button type="button" disabled={busy || !slots.length} onClick={() => void save()} className="rounded-lg bg-[#55766F] px-4 py-2 text-white disabled:opacity-50">Save hours</button><button type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button></div>
      </div>}
      {scope === 'date' && <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p>Customer pickup windows: {required ? 'required' : 'optional during rollout'}</p><button type="button" onClick={() => void toggle()} disabled={busy} className="rounded-lg border px-3 py-2">{required ? 'Disable requirement' : 'Require pickup windows'}</button></div>}
    </div>}
  </section>;
}
