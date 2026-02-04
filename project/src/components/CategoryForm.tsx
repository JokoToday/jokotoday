import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CMSCategory } from '../lib/cmsService';

interface CategoryFormProps {
  category: CMSCategory | null;
  onSave: () => void;
  onCancel: () => void;
}

export function CategoryForm({ category, onSave, onCancel }: CategoryFormProps) {
  const [formData, setFormData] = useState({
    title_en: category?.title_en || '',
    title_th: category?.title_th || '',
    description_en: category?.description_en || '',
    description_th: category?.description_th || '',
    slug: category?.slug || '',
    is_active: category?.is_active ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title_en.trim()) newErrors.title_en = 'Title (English) is required';
    if (!formData.title_th.trim()) newErrors.title_th = 'Title (Thai) is required';
    if (!formData.slug.trim()) newErrors.slug = 'Slug is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      let slug = formData.slug.trim();
      if (!category?.id) {
        slug = slug + '-' + Date.now().toString(36);
      }

      const data = {
        title_en: formData.title_en.trim(),
        title_th: formData.title_th.trim(),
        description_en: formData.description_en.trim() || null,
        description_th: formData.description_th.trim() || null,
        slug,
        is_active: formData.is_active,
      };

      if (category?.id) {
        const { error } = await supabase
          .from('cms_categories')
          .update(data)
          .eq('id', category.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cms_categories')
          .insert([data]);
        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving:', error);
      setErrors({ submit: 'Error saving category. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {category ? 'Edit Category' : 'New Category'}
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
              Title (English) *
            </label>
            <input
              type="text"
              value={formData.title_en}
              onChange={(e) => {
                setFormData({ ...formData, title_en: e.target.value });
                if (!category?.id) {
                  setFormData((prev) => ({ ...prev, slug: generateSlug(e.target.value) }));
                }
              }}
              className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                errors.title_en
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder="e.g., Croissants"
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
              placeholder="เช่น ครัวซอง"
            />
            {errors.title_th && <p className="text-red-600 text-xs mt-1">{errors.title_th}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug *</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg text-sm font-mono transition-colors ${
                errors.slug
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder="croissants"
            />
            {errors.slug && <p className="text-red-600 text-xs mt-1">{errors.slug}</p>}
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
              placeholder="Optional description..."
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
              placeholder="คำอธิบายเพิ่มเติม (ถ้ามี)..."
            />
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
              {loading ? 'Saving...' : category ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
