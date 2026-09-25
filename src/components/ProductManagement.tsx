import { useState, useEffect } from 'react';
import { X, AlertCircle, QrCode } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CMSProduct, CMSCategory, CMSPickupLocation } from '../lib/cmsService';
import { getPickupDays, PickupDay } from '../lib/availabilityService';

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
  name_zh: string;
  desc_en: string;
  desc_th: string;
  desc_zh: string;
  price: string;
  category_id: string;
  image: string;
  public_code: string;
  short_desc_en: string;
  short_desc_th: string;
  short_desc_zh: string;
  joko_note_en: string;
  joko_note_th: string;
  joko_note_zh: string;
  ingredients_en: string;
  ingredients_th: string;
  ingredients_zh: string;
  allergens_en: string;
  allergens_th: string;
  allergens_zh: string;
  storage_en: string;
  storage_th: string;
  storage_zh: string;
  best_enjoyed_en: string;
  best_enjoyed_th: string;
  best_enjoyed_zh: string;
  reheating_en: string;
  reheating_th: string;
  reheating_zh: string;
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

function dayAliases(day: PickupDay): string[] {
  return [day.day_key, day.label, day.label_en, day.label_th, day.label_zh]
    .filter((value): value is string => Boolean(value));
}

export function ProductForm({ product, categories, onSave, onCancel }: ProductFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name_en: product?.name_en || '',
    name_th: product?.name_th || '',
    name_zh: product?.name_zh || '',
    desc_en: product?.desc_en || '',
    desc_th: product?.desc_th || '',
    desc_zh: product?.desc_zh || '',
    price: product?.price?.toString() || '',
    category_id: product?.category_id || '',
    image: product?.image || '',
    public_code: product?.public_code || '',
    short_desc_en: product?.short_desc_en || '',
    short_desc_th: product?.short_desc_th || '',
    short_desc_zh: product?.short_desc_zh || '',
    joko_note_en: product?.joko_note_en || '',
    joko_note_th: product?.joko_note_th || '',
    joko_note_zh: product?.joko_note_zh || '',
    ingredients_en: product?.ingredients_en || '',
    ingredients_th: product?.ingredients_th || '',
    ingredients_zh: product?.ingredients_zh || '',
    allergens_en: product?.allergens_en || '',
    allergens_th: product?.allergens_th || '',
    allergens_zh: product?.allergens_zh || '',
    storage_en: product?.storage_en || '',
    storage_th: product?.storage_th || '',
    storage_zh: product?.storage_zh || '',
    best_enjoyed_en: product?.best_enjoyed_en || '',
    best_enjoyed_th: product?.best_enjoyed_th || '',
    best_enjoyed_zh: product?.best_enjoyed_zh || '',
    reheating_en: product?.reheating_en || '',
    reheating_th: product?.reheating_th || '',
    reheating_zh: product?.reheating_zh || '',
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
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);

  useEffect(() => {
    getPickupDays().then(setPickupDays).catch((error) => {
      console.error('Error loading pickup days for product form:', error);
      setErrors((current) => ({ ...current, pickup_days: 'Could not load pickup schedule.' }));
    });
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Errors = {};
    if (!formData.name_en.trim()) newErrors.name_en = 'Product name (English) is required';
    if (!formData.name_th.trim()) newErrors.name_th = 'Product name (Thai) is required';
    if (!formData.category_id) newErrors.category_id = 'Category is required';
    if (!formData.price) newErrors.price = 'Price is required';
    else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) < 0) newErrors.price = 'Price must be a valid positive number';
    if (!formData.slug.trim()) newErrors.slug = 'Slug is required';
    if (formData.public_code && !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(formData.public_code)) {
      newErrors.public_code = 'Use 3–32 uppercase letters, numbers, hyphens or underscores';
    }
    if (!formData.stock_total) newErrors.stock_total = 'Total stock is required';
    else if (isNaN(parseInt(formData.stock_total)) || parseInt(formData.stock_total) < 0) newErrors.stock_total = 'Total stock must be a valid positive number';
    if (product && !formData.stock_remaining) newErrors.stock_remaining = 'Remaining stock is required';
    else if (product && (isNaN(parseInt(formData.stock_remaining)) || parseInt(formData.stock_remaining) < 0)) newErrors.stock_remaining = 'Remaining stock must be a valid positive number';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateSlug = (text: string) => text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'name_en' | 'name_th') => {
    const value = e.target.value;
    setFormData({ ...formData, [field]: value });
    if (field === 'name_en' && !product?.id) setFormData(prev => ({ ...prev, slug: generateSlug(value) }));
  };

  const canonicalAvailableDays = (): string[] => {
    return Array.from(new Set(formData.available_days.map((storedValue) => {
      const configured = pickupDays.find((day) => dayAliases(day).includes(storedValue));
      return configured?.day_key || storedValue.replace(/\s-\s/g, ' – ');
    })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const desc_en = formData.desc_en.trim() || formData.name_en.trim();
      const desc_th = formData.desc_th.trim() || formData.name_th.trim();
      let slug = formData.slug.trim();
      if (!product?.id && slug) slug = slug + '-' + Date.now().toString(36);

      const stockByDay: Record<string, number> = {};
      Object.entries(formData.stock_by_day).forEach(([day, stock]) => {
        const num = parseInt(stock);
        if (!isNaN(num) && num >= 0) stockByDay[day] = num;
      });

      const baseData = {
        name_en: formData.name_en.trim(),
        name_th: formData.name_th.trim(),
        name_zh: formData.name_zh.trim() || null,
        desc_en,
        desc_th,
        desc_zh: formData.desc_zh.trim() || null,
        price: parseFloat(formData.price),
        category_id: formData.category_id,
        image: formData.image.trim() || null,
        public_code: formData.public_code.trim() || null,
        short_desc_en: formData.short_desc_en.trim() || null,
        short_desc_th: formData.short_desc_th.trim() || null,
        short_desc_zh: formData.short_desc_zh.trim() || null,
        joko_note_en: formData.joko_note_en.trim() || null,
        joko_note_th: formData.joko_note_th.trim() || null,
        joko_note_zh: formData.joko_note_zh.trim() || null,
        ingredients_en: formData.ingredients_en.trim() || null,
        ingredients_th: formData.ingredients_th.trim() || null,
        ingredients_zh: formData.ingredients_zh.trim() || null,
        allergens_en: formData.allergens_en.trim() || null,
        allergens_th: formData.allergens_th.trim() || null,
        allergens_zh: formData.allergens_zh.trim() || null,
        storage_en: formData.storage_en.trim() || null,
        storage_th: formData.storage_th.trim() || null,
        storage_zh: formData.storage_zh.trim() || null,
        best_enjoyed_en: formData.best_enjoyed_en.trim() || null,
        best_enjoyed_th: formData.best_enjoyed_th.trim() || null,
        best_enjoyed_zh: formData.best_enjoyed_zh.trim() || null,
        reheating_en: formData.reheating_en.trim() || null,
        reheating_th: formData.reheating_th.trim() || null,
        reheating_zh: formData.reheating_zh.trim() || null,
        is_sold_out: formData.is_sold_out,
        is_active: formData.is_active,
        slug,
        available_days: canonicalAvailableDays(),
        stock_by_day: stockByDay,
      };

      if (product?.id) {
        const { error } = await supabase.from('cms_products').update(baseData).eq('id', product.id);
        if (error) throw error;

        const stockUpdates: Record<string, number> = {};
        if (parseInt(formData.stock_total) !== product.stock_total) stockUpdates.stock_total = parseInt(formData.stock_total);
        if (parseInt(formData.stock_remaining) !== product.stock_remaining) stockUpdates.stock_remaining = parseInt(formData.stock_remaining);
        if (Object.keys(stockUpdates).length > 0) {
          const { error: stockError } = await supabase.from('cms_products').update(stockUpdates).eq('id', product.id);
          if (stockError) throw stockError;
        }
      } else {
        const { error } = await supabase.from('cms_products').insert([{ ...baseData, stock_total: parseInt(formData.stock_total) }]);
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

  const isPickupDaySelected = (day: PickupDay) => dayAliases(day).some((alias) => formData.available_days.includes(alias));

  const togglePickupDay = (day: PickupDay, checked: boolean) => {
    const aliases = dayAliases(day);
    const withoutAliases = formData.available_days.filter((value) => !aliases.includes(value));
    setFormData({
      ...formData,
      available_days: checked ? [...withoutAliases, day.day_key] : withoutAliases,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
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
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name (English) *</label>
                <input type="text" value={formData.name_en} onChange={(e) => handleNameChange(e, 'name_en')} className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${errors.name_en ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`} placeholder="e.g., Chocolate Croissant" />
                {errors.name_en && <p className="text-red-600 text-xs mt-1">{errors.name_en}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผลิตภัณฑ์ (ไทย) *</label>
                <input type="text" value={formData.name_th} onChange={(e) => handleNameChange(e, 'name_th')} className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${errors.name_th ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`} placeholder="เช่น ครัวซองช็อกโกแลต" />
                {errors.name_th && <p className="text-red-600 text-xs mt-1">{errors.name_th}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">产品名称 (中文简体)</label>
                <input type="text" value={formData.name_zh} onChange={(e) => setFormData({ ...formData, name_zh: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="例如：巧克力可颂" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${errors.category_id ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`}>
                  <option value="">Select a category</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.title_en} / {cat.title_th}</option>)}
                </select>
                {errors.category_id && <p className="text-red-600 text-xs mt-1">{errors.category_id}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (THB) *</label>
                <input type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${errors.price ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`} placeholder="45.00" />
                {errors.price && <p className="text-red-600 text-xs mt-1">{errors.price}</p>}
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Description & Media</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug *</label>
              <input type="text" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors font-mono ${errors.slug ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`} placeholder="chocolate-croissant" />
              {errors.slug && <p className="text-red-600 text-xs mt-1">{errors.slug}</p>}
              <p className="text-xs text-gray-500 mt-1">Auto-generated from English name (editable)</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (English)</label>
                <textarea value={formData.desc_en} onChange={(e) => setFormData({ ...formData, desc_en: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" rows={3} placeholder="Describe the product..." />
                <p className="text-xs text-gray-500 mt-1">Leave empty to use product name</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย (ไทย)</label>
                <textarea value={formData.desc_th} onChange={(e) => setFormData({ ...formData, desc_th: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" rows={3} placeholder="อธิบายผลิตภัณฑ์..." />
                <p className="text-xs text-gray-500 mt-1">ปล่อยว่างเพื่อใช้ชื่อ</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述 (中文简体)</label>
                <textarea value={formData.desc_zh} onChange={(e) => setFormData({ ...formData, desc_zh: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" rows={3} placeholder="描述产品..." />
                <p className="text-xs text-gray-500 mt-1">留空则使用产品名称</p>
              </div>
            </div>

            <div className="mt-6 border-t border-gray-200 pt-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Product Card Descriptor</h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {(['en', 'th', 'zh'] as const).map((lang) => (
                  <textarea
                    key={lang}
                    value={formData[`short_desc_${lang}`]}
                    onChange={(e) => setFormData({ ...formData, [`short_desc_${lang}`]: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder={lang === 'en' ? 'Flaky • almond cream • lightly dusted' : lang === 'th' ? 'คำอธิบายสั้น ๆ' : '简短描述'}
                  />
                ))}
              </div>

              <h4 className="text-sm font-semibold text-gray-900 mb-3 mt-5">JOKO Note</h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {(['en', 'th', 'zh'] as const).map((lang) => (
                  <textarea
                    key={lang}
                    value={formData[`joko_note_${lang}`]}
                    onChange={(e) => setFormData({ ...formData, [`joko_note_${lang}`]: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder={lang === 'en' ? 'A short JOKO observation…' : lang === 'th' ? 'บันทึกสั้น ๆ จาก JOKO…' : 'JOKO 小注…'}
                  />
                ))}
              </div>

              {([
                ['ingredients', 'Ingredients / ส่วนผสม / 配料'],
                ['allergens', 'Allergens / สารก่อภูมิแพ้ / 过敏原'],
                ['best_enjoyed', 'Best enjoyed / แนะนำการรับประทาน / 最佳食用'],
                ['storage', 'Storage / การเก็บรักษา / 保存方式'],
                ['reheating', 'Reheating / การอุ่น / 加热建议'],
              ] as const).map(([field, label]) => (
                <div key={field} className="mt-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">{label}</h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {(['en', 'th', 'zh'] as const).map((lang) => (
                      <textarea
                        key={lang}
                        value={formData[`${field}_${lang}`]}
                        onChange={(e) => setFormData({ ...formData, [`${field}_${lang}`]: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder={lang.toUpperCase()}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Image URL</label>
              <input type="url" value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="https://example.com/image.jpg" />
              {formData.image && (
                <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <img src={formData.image} alt="Preview" className="h-32 w-32 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="12" text-anchor="middle" dy=".3em" fill="%239ca3af"%3EImage Error%3C/text%3E%3C/svg%3E'; }} />
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <label className="block text-sm font-medium text-gray-800 mb-1">
                <span className="flex items-center gap-2"><QrCode className="w-4 h-4" />Permanent Product QR Code</span>
              </label>
              <input
                type="text"
                value={formData.public_code}
                disabled={Boolean(product?.public_code)}
                onChange={(e) => setFormData({ ...formData, public_code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase ${errors.public_code ? 'border-red-300 bg-red-50' : 'border-gray-300'} ${product?.public_code ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'focus:ring-2 focus:ring-emerald-500 focus:border-transparent'}`}
                placeholder="e.g. AC101"
              />
              {errors.public_code && <p className="text-red-600 text-xs mt-1">{errors.public_code}</p>}
              <p className="text-xs text-gray-600 mt-2">
                {product?.public_code
                  ? 'Permanent once assigned. Use the Products table → QR action to preview, download and print the generated code.'
                  : 'Optional. Assign only to real products that need a permanent /p/CODE printed identity.'}
              </p>
            </div>
          </div>

          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Stock *</label>
                <input type="number" min="0" value={formData.stock_total} onChange={(e) => setFormData({ ...formData, stock_total: e.target.value })} className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${errors.stock_total ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`} placeholder="100" />
                {errors.stock_total && <p className="text-red-600 text-xs mt-1">{errors.stock_total}</p>}
                <p className="text-xs text-gray-600 mt-1">{product ? 'Update total available stock' : 'Initial stock quantity'}</p>
              </div>

              {product && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remaining Stock *</label>
                  <input type="number" min="0" value={formData.stock_remaining} onChange={(e) => setFormData({ ...formData, stock_remaining: e.target.value })} className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${errors.stock_remaining ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500 focus:border-transparent' : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent'}`} placeholder="0" />
                  {errors.stock_remaining && <p className="text-red-600 text-xs mt-1">{errors.stock_remaining}</p>}
                  <p className="text-xs text-gray-600 mt-1">Manual override (waste, damage, offline sales)</p>
                </div>
              )}
            </div>

            {product && (
              <button type="button" onClick={() => setFormData({ ...formData, stock_remaining: formData.stock_total })} className="w-full px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">Reset Remaining = Total</button>
            )}
          </div>

          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pickup Rules</h3>
            {errors.pickup_days && <p className="text-sm text-red-600 mb-3">{errors.pickup_days}</p>}

            <div className="mb-4 bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-900 mb-3">Available Pickup Slots</label>
              <div className="space-y-2">
                {pickupDays.length === 0 ? (
                  <p className="text-sm text-gray-500">No pickup slots are configured. Add one under Admin → Cutoff Rules / Pickup Schedule.</p>
                ) : pickupDays.map((day) => (
                  <label key={day.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPickupDaySelected(day)}
                      onChange={(e) => togglePickupDay(day, e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-700">
                      {day.label_en || day.label}
                      {!day.is_open && <span className="text-xs text-gray-400 ml-2">(currently closed)</span>}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3">Selections are stored by stable pickup slot key, so labels and locations can change later.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">Stock Per Pickup Slot (Optional)</label>
              <div className="space-y-2">
                {pickupDays.map((day) => (
                  <div key={day.day_key} className="flex items-center gap-3">
                    <label className="flex-1 text-sm text-gray-600">{day.label_en || day.label}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.stock_by_day[day.day_key] || ''}
                      onChange={(e) => {
                        const newStockByDay = { ...formData.stock_by_day };
                        if (e.target.value) newStockByDay[day.day_key] = e.target.value;
                        else delete newStockByDay[day.day_key];
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
                <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500" />
                <span className="text-sm text-gray-700">Visible on website<span className="text-xs text-gray-500 ml-1">(uncheck to hide)</span></span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={formData.is_sold_out} onChange={(e) => setFormData({ ...formData, is_sold_out: e.target.checked })} className="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-500" />
                <span className="text-sm text-gray-700">Sold Out<span className="text-xs text-gray-500 ml-1">(check if unavailable)</span></span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
