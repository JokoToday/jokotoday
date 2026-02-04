import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CMSSetting } from '../lib/cmsService';

interface SettingFormProps {
  setting: CMSSetting | null;
  onSave: () => void;
  onCancel: () => void;
}

export function SettingForm({ setting, onSave, onCancel }: SettingFormProps) {
  const [formData, setFormData] = useState({
    setting_key: setting?.setting_key || '',
    value: setting?.value || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.setting_key.trim()) newErrors.setting_key = 'Setting key is required';
    if (!formData.value.trim()) newErrors.value = 'Value is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const data = {
        setting_key: formData.setting_key.trim(),
        value: formData.value.trim(),
      };

      if (setting?.id) {
        const { error } = await supabase
          .from('cms_settings')
          .update(data)
          .eq('id', setting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cms_settings')
          .insert([data]);
        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving:', error);
      setErrors({ submit: 'Error saving setting. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {setting ? 'Edit Setting' : 'New Setting'}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Setting Key *
            </label>
            <input
              type="text"
              value={formData.setting_key}
              onChange={(e) => setFormData({ ...formData, setting_key: e.target.value })}
              disabled={!!setting?.id}
              className={`w-full px-3 py-2 border rounded-lg text-sm font-mono transition-colors ${
                errors.setting_key
                  ? 'border-red-300 bg-red-50'
                  : setting?.id
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder="e.g., order_cutoff_time"
            />
            {errors.setting_key && <p className="text-red-600 text-xs mt-1">{errors.setting_key}</p>}
            <p className="text-xs text-gray-500 mt-1">Use underscores for spaces, cannot be changed after creation</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Value *
            </label>
            <textarea
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors resize-none ${
                errors.value
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder='e.g., {"status":"active"} or plain text value'
            />
            {errors.value && <p className="text-red-600 text-xs mt-1">{errors.value}</p>}
            <p className="text-xs text-gray-500 mt-1">Can be plain text or JSON</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Examples:</strong>
            </p>
            <ul className="text-xs text-blue-800 mt-2 space-y-1">
              <li>• store_name → JOKO TODAY</li>
              <li>• order_cutoff_time → Thursday 22:00</li>
              <li>• holiday_dates → ["2026-02-14","2026-04-13"]</li>
            </ul>
          </div>

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
              {loading ? 'Saving...' : setting ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
