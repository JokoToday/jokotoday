import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CutoffRule } from '../lib/availabilityService';

interface CutoffRulesManagementProps {
  rules: CutoffRule[];
  onRefresh: () => void;
}

interface PickupSlotRow {
  id: string;
  day_key: string;
  label: string;
  label_en: string | null;
  label_th: string | null;
  label_zh: string | null;
  pickup_weekday: number;
  location_id: string | null;
  cutoff_day: string;
  cutoff_time: string;
  is_open: boolean;
  sort_order: number;
}

interface PickupLocationRow {
  id: string;
  name_en: string;
  name_th: string | null;
  name_zh: string | null;
  is_active: boolean;
}

interface ScheduleForm {
  day_key: string;
  label_en: string;
  label_th: string;
  label_zh: string;
  pickup_weekday: number;
  location_id: string;
  location_key: string;
  cutoff_day: string;
  cutoff_time: string;
  is_open: boolean;
  sort_order: number;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function normalizeDayKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function CutoffRulesManagement({ rules, onRefresh }: CutoffRulesManagementProps) {
  const [slots, setSlots] = useState<PickupSlotRow[]>([]);
  const [locations, setLocations] = useState<PickupLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<PickupSlotRow | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<ScheduleForm>({
    day_key: '',
    label_en: '',
    label_th: '',
    label_zh: '',
    pickup_weekday: 5,
    location_id: '',
    location_key: '',
    cutoff_day: 'Wednesday',
    cutoff_time: '17:00',
    is_open: true,
    sort_order: 1,
  });

  const rulesByDayKey = useMemo(() => {
    const map = new Map<string, CutoffRule>();
    rules.forEach((rule) => {
      if (rule.day_key) map.set(rule.day_key, rule);
    });
    return map;
  }, [rules]);

  const loadScheduleData = async () => {
    setLoading(true);
    setError('');
    const [slotsRes, locationsRes] = await Promise.all([
      supabase.from('cms_pickup_days').select('*').order('sort_order', { ascending: true }),
      supabase.from('cms_pickup_locations').select('id, name_en, name_th, name_zh, is_active').order('sort_order', { ascending: true }),
    ]);

    if (slotsRes.error) {
      console.error('Error loading pickup slots:', slotsRes.error);
      setError(slotsRes.error.message);
    } else {
      setSlots((slotsRes.data || []) as PickupSlotRow[]);
    }

    if (locationsRes.error) {
      console.error('Error loading pickup locations:', locationsRes.error);
      setError((current) => current || locationsRes.error!.message);
    } else {
      setLocations((locationsRes.data || []) as PickupLocationRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadScheduleData();
  }, [rules]);

  const locationById = useMemo(() => {
    const map = new Map<string, PickupLocationRow>();
    locations.forEach((location) => map.set(location.id, location));
    return map;
  }, [locations]);

  const handleNew = () => {
    const firstLocation = locations.find((location) => location.is_active) || locations[0];
    setEditingSlot(null);
    setFormData({
      day_key: '',
      label_en: '',
      label_th: '',
      label_zh: '',
      pickup_weekday: 5,
      location_id: firstLocation?.id || '',
      location_key: firstLocation?.name_en || '',
      cutoff_day: 'Wednesday',
      cutoff_time: '17:00',
      is_open: true,
      sort_order: slots.length + 1,
    });
    setError('');
    setShowForm(true);
  };

  const handleEdit = (slot: PickupSlotRow) => {
    const rule = rulesByDayKey.get(slot.day_key);
    const location = slot.location_id ? locationById.get(slot.location_id) : undefined;
    setEditingSlot(slot);
    setFormData({
      day_key: slot.day_key,
      label_en: slot.label_en || slot.label,
      label_th: slot.label_th || '',
      label_zh: slot.label_zh || '',
      pickup_weekday: slot.pickup_weekday,
      location_id: slot.location_id || '',
      location_key: rule?.location || location?.name_en || '',
      cutoff_day: rule?.cutoff_day || slot.cutoff_day || 'Monday',
      cutoff_time: rule?.cutoff_time || slot.cutoff_time || '17:00',
      is_open: Boolean(slot.is_open && (rule ? rule.is_active : true)),
      sort_order: slot.sort_order,
    });
    setError('');
    setShowForm(true);
  };

  const handleLocationChange = (locationId: string) => {
    const location = locationById.get(locationId);
    setFormData((current) => ({
      ...current,
      location_id: locationId,
      location_key: location?.name_en || current.location_key,
    }));
  };

  const handleSave = async () => {
    const dayKey = normalizeDayKey(formData.day_key);
    if (!dayKey || !formData.label_en.trim() || !formData.location_id || !formData.cutoff_day || !formData.cutoff_time) {
      setError('Day key, English label, location, cutoff day and cutoff time are required.');
      return;
    }
    if (!Number.isInteger(formData.pickup_weekday) || formData.pickup_weekday < 0 || formData.pickup_weekday > 6) {
      setError('Pickup weekday is invalid.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const slotPayload = {
        day_key: dayKey,
        label: formData.label_en.trim(),
        label_en: formData.label_en.trim(),
        label_th: formData.label_th.trim() || formData.label_en.trim(),
        label_zh: formData.label_zh.trim() || null,
        pickup_weekday: formData.pickup_weekday,
        location_id: formData.location_id,
        // Keep the old mirror columns synchronized for legacy readers only.
        cutoff_day: formData.cutoff_day,
        cutoff_time: formData.cutoff_time,
        // New records stay closed until the authoritative cutoff rule exists.
        is_open: editingSlot ? formData.is_open : false,
        sort_order: formData.sort_order,
        updated_at: new Date().toISOString(),
      };

      if (editingSlot) {
        const { error: slotError } = await supabase
          .from('cms_pickup_days')
          .update(slotPayload)
          .eq('id', editingSlot.id);
        if (slotError) throw slotError;
      } else {
        const { error: slotError } = await supabase
          .from('cms_pickup_days')
          .insert([slotPayload]);
        if (slotError) throw slotError;
      }

      const rulePayload = {
        day_key: dayKey,
        pickup_label_en: formData.label_en.trim(),
        pickup_label_th: formData.label_th.trim() || formData.label_en.trim(),
        pickup_label_zh: formData.label_zh.trim() || null,
        pickup_day: WEEKDAYS[formData.pickup_weekday],
        // Legacy text key used by pickup_overrides. A future vendor migration
        // should replace this with a location/slot foreign key.
        location: formData.location_key.trim() || locationById.get(formData.location_id)?.name_en || formData.label_en.trim(),
        cutoff_day: formData.cutoff_day,
        cutoff_time: formData.cutoff_time,
        is_active: formData.is_open,
        sort_order: formData.sort_order,
        updated_at: new Date().toISOString(),
      };

      const { error: ruleError } = await supabase
        .from('pickup_cutoff_rules')
        .upsert([rulePayload], { onConflict: 'day_key' });

      if (ruleError) {
        if (!editingSlot) {
          await supabase.from('cms_pickup_days').update({ is_open: false }).eq('day_key', dayKey);
        }
        throw ruleError;
      }

      const { error: openStateError } = await supabase
        .from('cms_pickup_days')
        .update({ is_open: formData.is_open, updated_at: new Date().toISOString() })
        .eq('day_key', dayKey);
      if (openStateError) throw openStateError;

      setShowForm(false);
      setEditingSlot(null);
      await loadScheduleData();
      onRefresh();
    } catch (saveError) {
      console.error('Schedule save error:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Error saving pickup schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (slot: PickupSlotRow) => {
    if (!confirm(`Disable ${slot.label_en || slot.label}? Existing orders will not be changed.`)) return;
    setError('');
    const [slotResult, ruleResult] = await Promise.all([
      supabase.from('cms_pickup_days').update({ is_open: false }).eq('id', slot.id),
      supabase.from('pickup_cutoff_rules').update({ is_active: false }).eq('day_key', slot.day_key),
    ]);

    if (slotResult.error || ruleResult.error) {
      const message = slotResult.error?.message || ruleResult.error?.message || 'Could not disable pickup slot.';
      setError(message);
      return;
    }

    await loadScheduleData();
    onRefresh();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Pickup Schedule</h2>
          <p className="text-sm text-gray-500 mt-1">
            Pickup weekday, location, labels, cutoff and enabled state are database-driven. No website code change is required when these values change.
          </p>
        </div>
        <button
          onClick={handleNew}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium shrink-0"
        >
          + Add Pickup Slot
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {editingSlot ? 'Edit Pickup Slot' : 'New Pickup Slot'}
          </h3>
          <p className="text-xs text-gray-500 mb-5">
            The day key is a stable technical identifier. Do not change it after a slot is created; customer-facing labels can be edited freely.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Day Key *</label>
              <input
                type="text"
                value={formData.day_key}
                disabled={Boolean(editingSlot)}
                onChange={(e) => setFormData({ ...formData, day_key: normalizeDayKey(e.target.value) })}
                placeholder="saturday_maerim"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Pickup Weekday *</label>
              <select
                value={formData.pickup_weekday}
                onChange={(e) => setFormData({ ...formData, pickup_weekday: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">English Label *</label>
              <input
                type="text"
                value={formData.label_en}
                onChange={(e) => setFormData({ ...formData, label_en: e.target.value })}
                placeholder="Saturday – Mae Rim"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Thai Label</label>
              <input
                type="text"
                value={formData.label_th}
                onChange={(e) => setFormData({ ...formData, label_th: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Chinese Label</label>
              <input
                type="text"
                value={formData.label_zh}
                onChange={(e) => setFormData({ ...formData, label_zh: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Pickup Location *</label>
              <select
                value={formData.location_id}
                onChange={(e) => handleLocationChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name_en}{location.is_active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Order Cutoff Day *</label>
              <select
                value={formData.cutoff_day}
                onChange={(e) => setFormData({ ...formData, cutoff_day: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {WEEKDAYS.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Order Cutoff Time *</label>
              <input
                type="time"
                value={formData.cutoff_time}
                onChange={(e) => setFormData({ ...formData, cutoff_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Legacy Override Location Key</label>
              <input
                type="text"
                value={formData.location_key}
                onChange={(e) => setFormData({ ...formData, location_key: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-[11px] text-gray-500 mt-1">Kept for compatibility with holiday overrides until the vendor-ready schema migration.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <label className="flex items-center gap-2 text-gray-700 font-medium md:col-span-2">
              <input
                type="checkbox"
                checked={formData.is_open}
                onChange={(e) => setFormData({ ...formData, is_open: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              Accept orders for this pickup slot
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Pickup Slot'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingSlot(null); setError(''); }}
              disabled={saving}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Pickup Slot</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Weekday</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Location</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Cutoff</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">Loading schedule…</td></tr>
            ) : slots.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">No pickup slots configured.</td></tr>
            ) : (
              slots.map((slot) => {
                const rule = rulesByDayKey.get(slot.day_key);
                const location = slot.location_id ? locationById.get(slot.location_id) : undefined;
                const active = Boolean(slot.is_open && rule?.is_active);
                return (
                  <tr key={slot.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-sm">{slot.label_en || slot.label}</p>
                      <p className="text-xs text-gray-500 font-mono">{slot.day_key}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{WEEKDAYS[slot.pickup_weekday] || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{location?.name_en || 'Not linked'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {rule ? `${rule.cutoff_day} ${rule.cutoff_time}` : <span className="text-red-600">Missing rule</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {active ? 'Open' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => handleEdit(slot)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                        {active && (
                          <button onClick={() => handleDisable(slot)} className="text-red-600 hover:text-red-800 font-medium text-sm">Disable</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        Holiday closures and date-specific exceptions remain under <strong>Holiday Overrides</strong>. Cancellation deadlines remain under <strong>Cancellation Cutoff</strong>. Existing orders are snapshots and are never rewritten when schedule settings change.
      </div>
    </div>
  );
}
