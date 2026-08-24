import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
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

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function CutoffRulesManagement({ rules, onRefresh }: CutoffRulesManagementProps) {
  const [slots, setSlots] = useState<PickupSlotRow[]>([]);
  const [locations, setLocations] = useState<PickupLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const rulesByDayKey = useMemo(() => {
    const map = new Map<string, CutoffRule>();
    rules.forEach((rule) => {
      if (rule.day_key) map.set(rule.day_key, rule);
    });
    return map;
  }, [rules]);

  const locationById = useMemo(() => {
    const map = new Map<string, PickupLocationRow>();
    locations.forEach((location) => map.set(location.id, location));
    return map;
  }, [locations]);

  const loadScheduleData = async () => {
    setLoading(true);
    setError('');

    const [slotsResult, locationsResult] = await Promise.all([
      supabase
        .from('cms_pickup_days')
        .select('id, day_key, label, label_en, label_th, label_zh, pickup_weekday, location_id, is_open, sort_order')
        .order('sort_order', { ascending: true }),
      supabase
        .from('cms_pickup_locations')
        .select('id, name_en, name_th, name_zh, is_active')
        .order('sort_order', { ascending: true }),
    ]);

    if (slotsResult.error) {
      console.error('Error loading pickup slots:', slotsResult.error);
      setError(slotsResult.error.message);
    } else {
      setSlots((slotsResult.data || []) as PickupSlotRow[]);
    }

    if (locationsResult.error) {
      console.error('Error loading pickup locations:', locationsResult.error);
      setError((current) => current || locationsResult.error!.message);
    } else {
      setLocations((locationsResult.data || []) as PickupLocationRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadScheduleData();
  }, [rules]);

  const handleRefresh = async () => {
    await loadScheduleData();
    onRefresh();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Pickup Schedule</h2>
          <p className="text-sm text-gray-500 mt-1">
            Current pickup weekdays, locations and cutoffs are loaded from the database and used by the customer calendar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Schedule editing is temporarily read-only.</p>
          <p className="mt-1 leading-relaxed">
            The current production schedule spans two legacy tables, while existing orders still reference historical pickup labels. Editing these fields safely requires the transactional schedule RPC and stable pickup-date identifiers planned for the next database phase. Pickup Locations, Holiday Overrides and Cancellation Cutoff remain available in their own Admin sections.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500 text-sm">Loading schedule…</td>
              </tr>
            ) : slots.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500 text-sm">No pickup slots configured.</td>
              </tr>
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
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {location?.name_en || 'Not linked'}
                      {location && !location.is_active && <span className="ml-1 text-xs text-gray-400">(inactive)</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {rule ? `${rule.cutoff_day} ${rule.cutoff_time}` : <span className="text-red-600">Missing rule</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {active ? 'Open' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
        Existing orders remain immutable schedule snapshots. The next database phase will make schedule changes atomic and will separate recurring schedules, concrete pickup dates, allowed locations and shared date-level product capacity.
      </div>
    </div>
  );
}