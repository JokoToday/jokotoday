import { useState } from 'react';
import { X, AlertCircle, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CMSCategory } from '../lib/cmsService';

interface QuickAddProductProps {
  categories: CMSCategory[];
  onSave: () => void;
  onCancel: () => void;
}

interface QuickFormData {
  name_en: string;
  name_th: string;
  price: string;
  category_id: string;
  is_active: boolean;
}

interface Errors {
  [key: string]: string;
}

export function QuickAddProduct({ categories, onSave, onCancel }: QuickAddProductProps) {
  const [formData, setFormData] = useState<QuickFormData>({
    name_en: '',
    name_th: '',
    price: '',
    category_id: '',
    is_active: true,
  });

  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      + '-' + Date.now().toString(36);
  };

  const validateForm = (): boolean => {
    const newErrors: Errors = {};

    if (!formData.name_en.trim()) {
      newErrors.name_en = 'Product name (English) is required';
    }

    if (!formData.name_th.trim()) {
      newErrors.name_th = 'Product name (Thai) is required';
    }

    if (!formData.category_id) {
      newErrors.category_id = 'Category is required';
    }

    if (!formData.price) {
      newErrors.price = 'Price is required';
    } else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) < 0) {
      newErrors.price = 'Price must be a valid positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const slug = generateSlug(formData.name_en);

      const dataToSave = {
        name_en: formData.name_en.trim(),
        name_th: formData.name_th.trim(),
        desc_en: formData.name_en.trim(),
        desc_th: formData.name_th.trim(),
        price: parseFloat(formData.price),
        category_id: formData.category_id,
        slug: slug,
        is_active: formData.is_active,
        is_sold_out: false,
        image: null,
        stock_total: 100,
      };

      const { error } = await supabase
        .from('cms_products')
        .insert([dataToSave]);

      if (error) throw error;

      onSave();
    } catch (error) {
      console.error('Error saving:', error);
      setErrors({ submit: 'Error saving product. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Quick Add Product</h2>
            </div>
            <button
              onClick={onCancel}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-primary-100 text-sm mt-2">Add a product quickly with essential details only</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.submit && (
            <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{errors.submit}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Product Name (English) *
            </label>
            <input
              type="text"
              value={formData.name_en}
              onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
              className={`w-full px-3 py-2.5 border rounded-lg text-sm transition-colors ${
                errors.name_en
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder="e.g., Chocolate Croissant"
              autoFocus
            />
            {errors.name_en && <p className="text-red-600 text-xs mt-1">{errors.name_en}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              ชื่อผลิตภัณฑ์ (ไทย) *
            </label>
            <input
              type="text"
              value={formData.name_th}
              onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
              className={`w-full px-3 py-2.5 border rounded-lg text-sm transition-colors ${
                errors.name_th
                  ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              }`}
              placeholder="เช่น ครัวซองช็อกโกแลต"
            />
            {errors.name_th && <p className="text-red-600 text-xs mt-1">{errors.name_th}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Price (THB) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm transition-colors ${
                  errors.price
                    ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                    : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                }`}
                placeholder="45.00"
              />
              {errors.price && <p className="text-red-600 text-xs mt-1">{errors.price}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Category *
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm transition-colors ${
                  errors.category_id
                    ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                    : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                }`}
              >
                <option value="">Select...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.title_en}
                  </option>
                ))}
              </select>
              {errors.category_id && <p className="text-red-600 text-xs mt-1">{errors.category_id}</p>}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Make product visible on website
              </span>
            </label>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            <strong>Quick Add defaults:</strong> Description uses product name, stock starts at 100. Edit all details later.
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
