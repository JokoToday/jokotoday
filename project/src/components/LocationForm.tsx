import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CMSPickupLocation } from '../lib/cmsService';

interface LocationFormProps {
  location: CMSPickupLocation | null;
  onSave: () => void;
  onCancel: () => void;
}

export function LocationForm({ location, onSave, onCancel }: LocationFormProps) {
  const [formData, setFormData] = useState({
    name_en: location?.name_en || '',
    name_th: location?.name_th || '',
    description_en: location?.description_en || '',
    description_th: location?.description_th || '',
    maps_url: location?.maps_url || '',
    available_days: (location?.available_days as string[]) || [],
    is_active: location?.is_active ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name_en.trim()) newErrors.name_en = 'Name (English) is required';
    if (!formData.name_th.trim()) newErrors.name_th = 'Name (Thai) is required';

    setErrors(newErrors);
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
        description_en: formData.description_en.trim() || null,
        description_th: formData.description_th.trim() || null,
        maps_url: formData.maps_url.trim() || null,
        available_days: formData.available_days,
        is_active: formData.is_active,
      };

      if (location?.id) {
        const { error } = await supabase
          .from('cms_pickup_locations')
          .update(data)
          .eq('id', location.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cms_pickup_locations')
          .insert([data]);
        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving:', error);
      setErrors({ submit: 'Error saving location. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {location ? 'Edit Location' : 'New Location'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.submit && (
            <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{errors.submit}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name (English) *
              </label>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                  errors.name_en
                    ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                    : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                }`}
                placeholder="e.g., Mae Rim Location"
              />
              {errors.name_en && <p className="text-red-600 text-xs mt-1">{errors.name_en}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อ (ไทย) *
              </label>
              <input
                type="text"
                value={formData.name_th}
                onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                  errors.name_th
                    ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                    : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                }`}
                placeholder="เช่น สาขาแม่ริม"
              />
              {errors.name_th && <p className="text-red-600 text-xs mt-1">{errors.name_th}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (English)
            </label>
            <textarea
              value={formData.description_en}
              onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="Optional address or details..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              คำอธิบาย (ไทย)
            </label>
            <textarea
              value={formData.description_th}
              onChange={(e) => setFormData({ ...formData, description_th: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="ที่อยู่หรือรายละเอียดเพิ่มเติม..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Maps URL
            </label>
            <input
              type="url"
              value={formData.maps_url}
              onChange={(e) => setFormData({ ...formData, maps_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://maps.google.com/..."
            />
            <p className="text-xs text-gray-500 mt-1">Link to Google Maps location (optional)</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Available Pickup Days
            </label>
            <div className="space-y-2">
              {[
                { value: 'Friday', label: 'Friday' },
                { value: 'Saturday', label: 'Saturday' },
                { value: 'Sunday', label: 'Sunday' },
              ].map((day) => (
                <label key={day.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.available_days.includes(day.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          available_days: [...formData.available_days, day.value],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          available_days: formData.available_days.filter((d) => d !== day.value),
                        });
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{day.label}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : location ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
