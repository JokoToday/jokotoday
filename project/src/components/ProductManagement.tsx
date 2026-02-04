import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CMSProduct, CMSCategory, CMSPickupLocation } from '../lib/cmsService';

interface ProductFormProps {
  product: CMSProduct | null;
  categories: CMSCategory[];
  locations: CMSPickupLocation[];
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  name_en: string;
  name_th: string;
  desc_en: string;
  desc_th: string;
  price: string;
  category_id: string;
  image: string;
  is_sold_out: boolean;
  is_active: boolean;
  slug: string;
  stock_total: string;
  stock_remaining: string;
  available_days: string[];
  stock_by_day: Record<string, string>;
}

interface Errors {
  [key: string]: string;
}

export function ProductForm({ product, categories, locations, onSave, onCancel }: ProductFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name_en: product?.name_en || '',
    name_th: product?.name_th || '',
    desc_en: product?.desc_en || '',
    desc_th: product?.desc_th || '',
    price: product?.price?.toString() || '',
    category_id: product?.category_id || '',
    image: product?.image || '',
    is_sold_out: product?.is_sold_out || false,
    is_active: product?.is_active ?? true,
    slug: product?.slug || '',
    stock_total: product?.stock_total?.toString() || '0',
    stock_remaining: product?.stock_remaining?.toString() || '0',
    available_days: (product?.available_days as string[]) || [],
    stock_by_day: product?.stock_by_day
      ? Object.fromEntries(Object.entries(product.stock_by_day).map(([k, v]) => [k, v.toString()]))
      : {},
  });

  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

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

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required';
    }

    if (!formData.stock_total) {
      newErrors.stock_total = 'Total stock is required';
    } else if (isNaN(parseInt(formData.stock_total)) || parseInt(formData.stock_total) < 0) {
      newErrors.stock_total = 'Total stock must be a valid positive number';
    }

    if (product && !formData.stock_remaining) {
      newErrors.stock_remaining = 'Remaining stock is required';
    } else if (product && (isNaN(parseInt(formData.stock_remaining)) || parseInt(formData.stock_remaining) < 0)) {
      newErrors.stock_remaining = 'Remaining stock must be a valid positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'name_en' | 'name_th') => {
    const value = e.target.value;
    setFormData({ ...formData, [field]: value });

    if (field === 'name_en' && !product?.id) {
      setFormData(prev => ({ ...prev, slug: generateSlug(value) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      // Ensure descriptions have values (required by database)
      const desc_en = formData.desc_en.trim() || formData.name_en.trim();
      const desc_th = formData.desc_th.trim() || formData.name_th.trim();

      // Ensure unique slug for new products
      let slug = formData.slug.trim();
      if (!product?.id && slug) {
        // Add timestamp to ensure uniqueness for new products
        slug = slug + '-' + Date.now().toString(36);
      }

      // Normalize available_days to use en-dashes for consistency
      const normalizedAvailableDays = formData.available_days.map(day =>
        day.replace(/\s-\s/g, ' – ')
      );

      const stockByDay: Record<string, number> = {};
      Object.entries(formData.stock_by_day).forEach(([day, stock]) => {
        const num = parseInt(stock);
        if (!isNaN(num) && num >= 0) {
          stockByDay[day] = num;
        }
      });

      const baseData = {
        name_en: formData.name_en.trim(),
        name_th: formData.name_th.trim(),
        desc_en,
        desc_th,
        price: parseFloat(formData.price),
        category_id: formData.category_id,
        image: formData.image.trim() || null,
        is_sold_out: formData.is_sold_out,
        is_active: formData.is_active,
        slug,
        available_days: normalizedAvailableDays,
        stock_by_day: stockByDay,
      };

      if (product?.id) {
        const { error } = await supabase
          .from('cms_products')
          .update(baseData)
          .eq('id', product.id);
        if (error) throw error;

        const stockUpdates: Record<string, number> = {};
        if (parseInt(formData.stock_total) !== product.stock_total) {
          stockUpdates.stock_total = parseInt(formData.stock_total);
        }
        if (parseInt(formData.stock_remaining) !== product.stock_remaining) {
          stockUpdates.stock_remaining = parseInt(formData.stock_remaining);
        }

        if (Object.keys(stockUpdates).length > 0) {
          const { error: stockError } = await supabase
            .from('cms_products')
            .update(stockUpdates)
            .eq('id', product.id);
          if (stockError) throw stockError;
        }
      } else {
        const newData = {
          ...baseData,
          stock_total: parseInt(formData.stock_total),
        };
        const { error } = await supabase
          .from('cms_products')
          .insert([newData]);
        if (error) throw error;
      }

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
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errors.submit && (
            <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{errors.submit}</p>
            </div>
          )}

          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name (English) *
                </label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => handleNameChange(e, 'name_en')}
                  className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                    errors.name_en
                      ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                      : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                  }`}
                  placeholder="e.g., Chocolate Croissant"
                />
                {errors.name_en && <p className="text-red-600 text-xs mt-1">{errors.name_en}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อผลิตภัณฑ์ (ไทย) *
                </label>
                <input
                  type="text"
                  value={formData.name_th}
                  onChange={(e) => handleNameChange(e, 'name_th')}
                  className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                    errors.name_th
                      ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                      : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                  }`}
                  placeholder="เช่น ครัวซองช็อกโกแลต"
                />
                {errors.name_th && <p className="text-red-600 text-xs mt-1">{errors.name_th}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                    errors.category_id
                      ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                      : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                  }`}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.title_en} / {cat.title_th}
                    </option>
                  ))}
                </select>
                {errors.category_id && <p className="text-red-600 text-xs mt-1">{errors.category_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (THB) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                    errors.price
                      ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                      : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                  }`}
                  placeholder="45.00"
                />
                {errors.price && <p className="text-red-600 text-xs mt-1">{errors.price}</p>}
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Description & Media</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Slug *
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors font-mono ${
                  errors.slug
                    ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                    : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                }`}
                placeholder="chocolate-croissant"
              />
              {errors.slug && <p className="text-red-600 text-xs mt-1">{errors.slug}</p>}
              <p className="text-xs text-gray-500 mt-1">Auto-generated from English name (editable)</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (English)
                </label>
                <textarea
                  value={formData.desc_en}
                  onChange={(e) => setFormData({ ...formData, desc_en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Describe the product..."
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to use product name</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบาย (ไทย)
                </label>
                <textarea
                  value={formData.desc_th}
                  onChange={(e) => setFormData({ ...formData, desc_th: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="อธิบายผลิตภัณฑ์..."
                />
                <p className="text-xs text-gray-500 mt-1">ปล่อยว่างเพื่อใช้ชื่อ</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Image URL
              </label>
              <input
                type="url"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="https://example.com/image.jpg"
              />
              {formData.image && (
                <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <img
                    src={formData.image}
                    alt="Preview"
                    className="h-32 w-32 object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="12" text-anchor="middle" dy=".3em" fill="%239ca3af"%3EImage Error%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Stock *
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock_total}
                  onChange={(e) => setFormData({ ...formData, stock_total: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                    errors.stock_total
                      ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                      : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                  }`}
                  placeholder="100"
                />
                {errors.stock_total && <p className="text-red-600 text-xs mt-1">{errors.stock_total}</p>}
                <p className="text-xs text-gray-600 mt-1">
                  {product ? 'Update total available stock' : 'Initial stock quantity'}
                </p>
              </div>

              {product && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Remaining Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_remaining}
                    onChange={(e) => setFormData({ ...formData, stock_remaining: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                      errors.stock_remaining
                        ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent'
                        : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                    }`}
                    placeholder="0"
                  />
                  {errors.stock_remaining && <p className="text-red-600 text-xs mt-1">{errors.stock_remaining}</p>}
                  <p className="text-xs text-gray-600 mt-1">
                    Manual override (waste, damage, offline sales)
                  </p>
                </div>
              )}
            </div>

            {product && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, stock_remaining: formData.stock_total })}
                className="w-full px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset Remaining = Total
              </button>
            )}
          </div>

          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pickup Rules</h3>

            <div className="mb-4 bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-900 mb-3">
                Available Pickup Days
              </label>
              <div className="space-y-2">
                {[
                  { value: 'Friday – Mae Rim', label: 'Friday – Mae Rim' },
                  { value: 'Saturday – Mae Rim', label: 'Saturday – Mae Rim' },
                  { value: 'Sunday – In-Town', label: 'Sunday – In-Town' },
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
                      className="w-4 h-4 text-amber-600 rounded focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-700">{day.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3">Select which days this product is available</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">
                Stock Per Pickup Day (Optional)
              </label>
              <div className="space-y-2">
                {[
                  { key: 'friday_maerim', label: 'Friday – Mae Rim' },
                  { key: 'saturday_maerim', label: 'Saturday – Mae Rim' },
                  { key: 'sunday_intown', label: 'Sunday – In-Town' },
                ].map((day) => (
                  <div key={day.key} className="flex items-center gap-3">
                    <label className="flex-1 text-sm text-gray-600">{day.label}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.stock_by_day[day.key] || ''}
                      onChange={(e) => {
                        const newStockByDay = { ...formData.stock_by_day };
                        if (e.target.value) {
                          newStockByDay[day.key] = e.target.value;
                        } else {
                          delete newStockByDay[day.key];
                        }
                        setFormData({ ...formData, stock_by_day: newStockByDay });
                      }}
                      className="w-20 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">Leave empty to use default stock limit</p>
            </div>
          </div>

          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability</h3>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  Visible on website
                  <span className="text-xs text-gray-500 ml-1">(uncheck to hide)</span>
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_sold_out}
                  onChange={(e) => setFormData({ ...formData, is_sold_out: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">
                  Sold Out
                  <span className="text-xs text-gray-500 ml-1">(check if unavailable)</span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
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
              {loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
