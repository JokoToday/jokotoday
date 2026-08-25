import { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CMSPickupLocation } from '../lib/cmsService';

interface LocationFormProps {
  location: CMSPickupLocation | null;
  onSave: () => void;
  onCancel: () => void;
}

interface ActiveScheduleDependency {
  id: string;
  label_en: string;
}

export function LocationForm({ location, onSave, onCancel }: LocationFormProps) {
  const [formData, setFormData] = useState({
    name_en: location?.name_en || '',
    name_th: location?.name_th || '',
    name_zh: location?.name_zh || '',
    description_en: location?.description_en || '',
    description_th: location?.description_th || '',
    description_zh: location?.description_zh || '',
    maps_url: location?.maps_url || '',
    // Legacy compatibility field. Actual recurring v2 day/location relationships
    // are managed by pickup_schedule_locations in Pickup Schedule.
    available_days: (location?.available_days as string[]) || [],
    is_active: location?.is_active ?? true,
  });

  const [linkedSlots, setLinkedSlots] = useState<string[]>([]);
  const [activeV2Schedules, setActiveV2Schedules] = useState<ActiveScheduleDependency[]>([]);
  const [dependencyLoading, setDependencyLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!location?.id) {
      setLinkedSlots([]);
      setActiveV2Schedules([]);
      return;
    }

    let cancelled = false;
    setDependencyLoading(true);

    void (async () => {
      const [legacyResult, v2LinksResult] = await Promise.all([
        supabase
          .from('cms_pickup_days')
          .select('label_en, label')
          .eq('location_id', location.id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('pickup_schedule_locations')
          .select('schedule_id')
          .eq('location_id', location.id)
          .eq('is_active', true),
      ]);

      if (cancelled) return;

      if (legacyResult.error) {
        console.error('Error loading linked legacy pickup slots:', legacyResult.error);
      } else {
        setLinkedSlots((legacyResult.data || []).map((slot) => slot.label_en || slot.label));
      }

      if (v2LinksResult.error) {
        console.error('Error loading v2 schedule dependencies:', v2LinksResult.error);
        setErrors((current) => ({ ...current, dependency: 'Could not verify active schedule dependencies. Location deactivation is disabled.' }));
        setActiveV2Schedules([]);
        setDependencyLoading(false);
        return;
      }

      const scheduleIds = Array.from(new Set((v2LinksResult.data || []).map((link) => link.schedule_id)));
      if (scheduleIds.length === 0) {
        setActiveV2Schedules([]);
        setDependencyLoading(false);
        return;
      }

      const schedulesResult = await supabase
        .from('pickup_schedules')
        .select('id, label_en')
        .in('id', scheduleIds)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (cancelled) return;

      if (schedulesResult.error) {
        console.error('Error loading active v2 schedules:', schedulesResult.error);
        setErrors((current) => ({ ...current, dependency: 'Could not verify active schedule dependencies. Location deactivation is disabled.' }));
        setActiveV2Schedules([]);
      } else {
        setActiveV2Schedules((schedulesResult.data || []) as ActiveScheduleDependency[]);
        setErrors((current) => {
          const next = { ...current };
          delete next.dependency;
          return next;
        });
      }
      setDependencyLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [location?.id]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name_en.trim()) newErrors.name_en = 'Name (English) is required';
    if (!formData.name_th.trim()) newErrors.name_th = 'Name (Thai) is required';

    if (location?.id && !formData.is_active) {
      if (dependencyLoading || errors.dependency) {
        newErrors.submit = 'Cannot deactivate this location until active v2 schedule dependencies are verified.';
      } else if (activeV2Schedules.length > 0) {
        newErrors.submit = `This location is still used by active pickup schedule${activeV2Schedules.length === 1 ? '' : 's'}: ${activeV2Schedules.map((schedule) => schedule.label_en).join(', ')}. Reassign or deactivate those schedules first.`;
      }
    }

    setErrors((current) => ({ ...current, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const data = {
        name_en: formData.name_en.trim(),
        name_th: formData.name_th.trim(),
        name_zh: formData.name_zh.trim() || null,
        description_en: formData.description_en.trim() || null,
        description_th: formData.description_th.trim() || null,
        description_zh: formData.description_zh.trim() || null,
        maps_url: formData.maps_url.trim() || null,
        available_days: formData.available_days,
        is_active: formData.is_active,
      };

      if (location?.id) {
        const { error } = await supabase.from('cms_pickup_locations').update(data).eq('id', location.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cms_pickup_locations').insert([data]);
        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving:', error);
      setErrors((current) => ({ ...current, submit: 'Error saving location. Please try again.' }));
    } finally {
      setLoading(false);
    }
  };

  const deactivationProtected = Boolean(
    location?.id
    && location.is_active
    && (dependencyLoading || Boolean(errors.dependency) || activeV2Schedules.length > 0)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">{location ? 'Edit Location' : 'New Location'}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.submit && (
            <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{errors.submit}</p>
            </div>
          )}
          {errors.dependency && (
            <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">{errors.dependency}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name (English) *</label>
              <input type="text" value={formData.name_en} onChange={(e) => setFormData({ ...formData, name_en: e.target.value })} className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${errors.name_en ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`} placeholder="e.g., Mae Rim Location" />
              {errors.name_en && <p className="text-red-600 text-xs mt-1">{errors.name_en}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ (ไทย) *</label>
              <input type="text" value={formData.name_th} onChange={(e) => setFormData({ ...formData, name_th: e.target.value })} className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${errors.name_th ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`} placeholder="เช่น สาขาแม่ริม" />
              {errors.name_th && <p className="text-red-600 text-xs mt-1">{errors.name_th}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名称 (中文简体)</label>
              <input type="text" value={formData.name_zh} onChange={(e) => setFormData({ ...formData, name_zh: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="例如：Mae Rim 分店" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (English)</label>
            <textarea value={formData.description_en} onChange={(e) => setFormData({ ...formData, description_en: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" placeholder="Optional address or details..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย (ไทย)</label>
            <textarea value={formData.description_th} onChange={(e) => setFormData({ ...formData, description_th: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" placeholder="ที่อยู่หรือรายละเอียดเพิ่มเติม..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述 (中文简体)</label>
            <textarea value={formData.description_zh} onChange={(e) => setFormData({ ...formData, description_zh: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" placeholder="可选地址或详情..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps URL</label>
            <input type="url" value={formData.maps_url} onChange={(e) => setFormData({ ...formData, maps_url: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="https://maps.google.com/..." />
            <p className="text-xs text-gray-500 mt-1">Link to Google Maps location (optional)</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-900 mb-1">Pickup schedule usage</p>
            {activeV2Schedules.length > 0 ? (
              <>
                <p className="text-sm text-gray-700">Used by active v2 schedule{activeV2Schedules.length === 1 ? '' : 's'}:</p>
                <ul className="text-sm text-gray-700 list-disc pl-5 mt-1 space-y-1">
                  {activeV2Schedules.map((schedule) => <li key={schedule.id}>{schedule.label_en}</li>)}
                </ul>
                <p className="text-xs text-blue-700 mt-2">Reassign or deactivate these schedules before deactivating this location.</p>
              </>
            ) : dependencyLoading ? (
              <p className="text-sm text-gray-600">Checking active v2 schedule dependencies…</p>
            ) : (
              <p className="text-sm text-gray-600">No active v2 recurring schedules currently depend on this location.</p>
            )}

            {linkedSlots.length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs font-medium text-gray-700 mb-1">Legacy pickup slots</p>
                <ul className="text-xs text-gray-600 list-disc pl-5 space-y-1">
                  {linkedSlots.map((slot) => <li key={slot}>{slot}</li>)}
                </ul>
              </div>
            )}
          </div>

          <label className={`flex items-center gap-3 ${deactivationProtected ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={formData.is_active}
              disabled={deactivationProtected}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          {deactivationProtected && (
            <p className="text-xs text-amber-700 -mt-2">This active location cannot be deactivated while an active v2 recurring schedule depends on it.</p>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading || dependencyLoading} className="flex-1 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Saving...' : location ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
