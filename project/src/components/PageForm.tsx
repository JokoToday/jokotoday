import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CMSPage } from '../lib/cmsService';

interface PageFormProps {
  page: CMSPage | null;
  onSave: () => void;
  onCancel: () => void;
}

export function PageForm({ page, onSave, onCancel }: PageFormProps) {
  const [formData, setFormData] = useState({
    page_key: page?.page_key || '',
    title_en: page?.title_en || '',
    title_th: page?.title_th || '',
    body_en: page?.body_en || '',
    body_th: page?.body_th || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.page_key.trim()) newErrors.page_key = 'Page key is required';
    if (!formData.title_en.trim()) newErrors.title_en = 'Title (English) is required';
    if (!formData.title_th.trim()) newErrors.title_th = 'Title (Thai) is required';
    if (!formData.body_en.trim()) newErrors.body_en = 'Body (English) is required';
    if (!formData.body_th.trim()) newErrors.body_th = 'Body (Thai) is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const data = {
        page_key: formData.page_key.trim(),
        title_en: formData.title_en.trim(),
        title_th: formData.title_th.trim(),
        body_en: formData.body_en.trim(),
        body_th: formData.body_th.trim(),
      };

      if (page?.id) {
        const { error } = await supabase
          .from('cms_pages')
          .update(data)
          .eq('id', page.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cms_pages')
          .insert([data]);
        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving:', error);
      setErrors({ submit: 'Error saving page. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">
            {page ? 'Edit Page' : 'New Page'}
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
              Page Key (system identifier) *
            </label>
            <input
              type="text"
              value={formData.page_key}
              onChange={(e) => setFormData({ ...formData, page_key: e.target.value })}
              disabled={!!page?.id}
              className={`w-full px-3 py-2 border rounded-lg text-sm font-mono transition-colors ${
                errors.page_key
                  ? 'border-red-300 bg-red-50'
                  : page?.id
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder="e.g., home_hero"
            />
            {errors.page_key && <p className="text-red-600 text-xs mt-1">{errors.page_key}</p>}
            <p className="text-xs text-gray-500 mt-1">Cannot be changed after creation</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title (English) *
              </label>
              <input
                type="text"
                value={formData.title_en}
                onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                  errors.title_en
                    ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                    : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                }`}
                placeholder="Page title..."
              />
              {errors.title_en && <p className="text-red-600 text-xs mt-1">{errors.title_en}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อ (ไทย) *
              </label>
              <input
                type="text"
                value={formData.title_th}
                onChange={(e) => setFormData({ ...formData, title_th: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                  errors.title_th
                    ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                    : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                }`}
                placeholder="ชื่อหน้า..."
              />
              {errors.title_th && <p className="text-red-600 text-xs mt-1">{errors.title_th}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Body Content (English) *
            </label>
            <textarea
              value={formData.body_en}
              onChange={(e) => setFormData({ ...formData, body_en: e.target.value })}
              rows={5}
              className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors resize-none ${
                errors.body_en
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder="Page content in English..."
            />
            {errors.body_en && <p className="text-red-600 text-xs mt-1">{errors.body_en}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              เนื้อหา (ไทย) *
            </label>
            <textarea
              value={formData.body_th}
              onChange={(e) => setFormData({ ...formData, body_th: e.target.value })}
              rows={5}
              className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors resize-none ${
                errors.body_th
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder="เนื้อหาหน้าเป็นภาษาไทย..."
            />
            {errors.body_th && <p className="text-red-600 text-xs mt-1">{errors.body_th}</p>}
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
              {loading ? 'Saving...' : page ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
