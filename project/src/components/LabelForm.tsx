import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CMSLabel } from '../lib/cmsService';

interface LabelFormProps {
  label: CMSLabel | null;
  onSave: () => void;
  onCancel: () => void;
}

export function LabelForm({ label, onSave, onCancel }: LabelFormProps) {
  const [formData, setFormData] = useState({
    key: label?.key || '',
    text_en: label?.text_en || '',
    text_th: label?.text_th || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.key.trim()) newErrors.key = 'Label key is required';
    if (!formData.text_en.trim()) newErrors.text_en = 'English text is required';
    if (!formData.text_th.trim()) newErrors.text_th = 'Thai text is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const data = {
        key: formData.key.trim(),
        text_en: formData.text_en.trim(),
        text_th: formData.text_th.trim(),
      };

      if (label?.id) {
        const { error } = await supabase
          .from('cms_labels')
          .update(data)
          .eq('id', label.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cms_labels')
          .insert([data]);
        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving:', error);
      setErrors({ submit: 'Error saving label. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {label ? 'Edit Label' : 'New Label'}
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
              Label Key (system identifier) *
            </label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              disabled={!!label?.id}
              className={`w-full px-3 py-2 border rounded-lg text-sm font-mono transition-colors ${
                errors.key
                  ? 'border-red-300 bg-red-50'
                  : label?.id
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder="e.g., btn_add_to_cart"
            />
            {errors.key && <p className="text-red-600 text-xs mt-1">{errors.key}</p>}
            <p className="text-xs text-gray-500 mt-1">e.g., btn_add_to_cart, label_price, error_required</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Text (English) *
            </label>
            <input
              type="text"
              value={formData.text_en}
              onChange={(e) => setFormData({ ...formData, text_en: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                errors.text_en
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder="e.g., Add to Cart"
            />
            {errors.text_en && <p className="text-red-600 text-xs mt-1">{errors.text_en}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ข้อความ (ไทย) *
            </label>
            <input
              type="text"
              value={formData.text_th}
              onChange={(e) => setFormData({ ...formData, text_th: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                errors.text_th
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder="เช่น เพิ่มลงตะกร้า"
            />
            {errors.text_th && <p className="text-red-600 text-xs mt-1">{errors.text_th}</p>}
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
              {loading ? 'Saving...' : label ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
