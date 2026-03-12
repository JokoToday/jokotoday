import { useState } from 'react';
import { X, AlertCircle, Plus, Pencil, Trash2, Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface CancellationCutoffRule {
  id: string;
  pickup_label_en: string;
  pickup_label_th: string;
  pickup_label_zh: string | null;
  cutoff_day: string;
  cutoff_time: string;
  notice_en: string;
  notice_th: string;
  notice_zh: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  rules: CancellationCutoffRule[];
  onRefresh: () => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EMPTY_FORM = {
  pickup_label_en: '',
  pickup_label_th: '',
  pickup_label_zh: '',
  cutoff_day: '',
  cutoff_time: '17:00',
  notice_en: '',
  notice_th: '',
  notice_zh: '',
  is_active: true,
  sort_order: 0,
};

export function CancellationCutoffManagement({ rules, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CancellationCutoffRule | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const openNew = () => {
    setFormData({ ...EMPTY_FORM, sort_order: rules.length + 1 });
    setEditing(null);
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (rule: CancellationCutoffRule) => {
    setFormData({
      pickup_label_en: rule.pickup_label_en,
      pickup_label_th: rule.pickup_label_th,
      pickup_label_zh: rule.pickup_label_zh ?? '',
      cutoff_day: rule.cutoff_day,
      cutoff_time: rule.cutoff_time,
      notice_en: rule.notice_en,
      notice_th: rule.notice_th,
      notice_zh: rule.notice_zh ?? '',
      is_active: rule.is_active,
      sort_order: rule.sort_order,
    });
    setEditing(rule);
    setErrors({});
    setShowForm(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.pickup_label_en.trim()) e.pickup_label_en = 'English pickup label is required';
    if (!formData.pickup_label_th.trim()) e.pickup_label_th = 'Thai pickup label is required';
    if (!formData.cutoff_day) e.cutoff_day = 'Cutoff day is required';
    if (!formData.cutoff_time) e.cutoff_time = 'Cutoff time is required';
    if (!formData.notice_en.trim()) e.notice_en = 'English notice text is required';
    if (!formData.notice_th.trim()) e.notice_th = 'Thai notice text is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        pickup_label_en: formData.pickup_label_en.trim(),
        pickup_label_th: formData.pickup_label_th.trim(),
        pickup_label_zh: formData.pickup_label_zh.trim() || null,
        cutoff_day: formData.cutoff_day,
        cutoff_time: formData.cutoff_time,
        notice_en: formData.notice_en.trim(),
        notice_th: formData.notice_th.trim(),
        notice_zh: formData.notice_zh.trim() || null,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
      };

      if (editing) {
        const { error } = await supabase
          .from('cancellation_cutoff_rules')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cancellation_cutoff_rules')
          .insert([payload]);
        if (error) throw error;
      }

      setShowForm(false);
      setEditing(null);
      onRefresh();
    } catch (err) {
      console.error('Save error:', err);
      setErrors({ submit: 'Error saving rule. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this cancellation cutoff rule?')) return;
    try {
      const { error } = await supabase
        .from('cancellation_cutoff_rules')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      onRefresh();
    } catch (err) {
      console.error('Deactivate error:', err);
      alert('Error deactivating rule');
    }
  };

  const field = (
    key: keyof typeof formData,
    placeholder: string,
    type: 'text' | 'textarea' | 'time' | 'select' | 'checkbox' | 'number' = 'text'
  ) => {
    const base =
      'w-full px-3 py-2 border rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';
    const errClass = errors[key as string] ? 'border-red-300 bg-red-50' : 'border-gray-300';

    if (type === 'textarea') {
      return (
        <textarea
          value={formData[key] as string}
          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
          placeholder={placeholder}
          rows={3}
          className={`${base} ${errClass} resize-none`}
        />
      );
    }
    if (type === 'select') {
      return (
        <select
          value={formData[key] as string}
          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
          className={`${base} ${errClass}`}
        >
          <option value="">{placeholder}</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      );
    }
    if (type === 'checkbox') {
      return (
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={formData[key] as boolean}
            onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 accent-primary-600"
          />
          Active
        </label>
      );
    }
    return (
      <input
        type={type}
        value={formData[key] as string | number}
        onChange={(e) =>
          setFormData({
            ...formData,
            [key]: type === 'number' ? parseInt(e.target.value) || 0 : e.target.value,
          })
        }
        placeholder={placeholder}
        className={`${base} ${errClass}`}
      />
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Cancellation Cutoff Deadlines</h2>
          <p className="text-sm text-gray-500 mt-1">
            Define when customers can no longer cancel orders for each pickup slot
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-semibold text-gray-900">
              {editing ? 'Edit Cancellation Cutoff Rule' : 'New Cancellation Cutoff Rule'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {errors.submit && (
            <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700 text-sm">{errors.submit}</p>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Pickup Slot Labels
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  {field('pickup_label_en', 'English label, e.g. Friday – Mae Rim')}
                  {errors.pickup_label_en && (
                    <p className="text-red-600 text-xs mt-1">{errors.pickup_label_en}</p>
                  )}
                </div>
                <div>
                  {field('pickup_label_th', 'Thai label, e.g. วันศุกร์ – แม่ริม')}
                  {errors.pickup_label_th && (
                    <p className="text-red-600 text-xs mt-1">{errors.pickup_label_th}</p>
                  )}
                </div>
                <div>
                  {field('pickup_label_zh', 'Chinese label (optional), e.g. 周五 – 梅林')}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Cancellation Deadline
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  {field('cutoff_day', 'Select cutoff day', 'select')}
                  {errors.cutoff_day && (
                    <p className="text-red-600 text-xs mt-1">{errors.cutoff_day}</p>
                  )}
                </div>
                <div>
                  {field('cutoff_time', 'Cutoff time', 'time')}
                  {errors.cutoff_time && (
                    <p className="text-red-600 text-xs mt-1">{errors.cutoff_time}</p>
                  )}
                </div>
                <div>
                  {field('sort_order', 'Sort order', 'number')}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Customer-Facing Notice Text
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  {field(
                    'notice_en',
                    'e.g. Orders for this pickup can be cancelled until Wednesday at 5pm.',
                    'textarea'
                  )}
                  {errors.notice_en && (
                    <p className="text-red-600 text-xs mt-1">{errors.notice_en}</p>
                  )}
                </div>
                <div>
                  {field(
                    'notice_th',
                    'e.g. สามารถยกเลิกออเดอร์ได้ถึงวันพุธเวลา 17:00 น.',
                    'textarea'
                  )}
                  {errors.notice_th && (
                    <p className="text-red-600 text-xs mt-1">{errors.notice_th}</p>
                  )}
                </div>
                <div>
                  {field('notice_zh', 'e.g. 此提货的订单可在周三17:00前取消。(optional)', 'textarea')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              {field('is_active', '', 'checkbox')}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-5 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors text-sm disabled:opacity-50"
                >
                  {loading ? 'Saving…' : editing ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Ban className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No cancellation cutoff rules yet</p>
          <p className="text-gray-400 text-xs mt-1">
            Add rules to control when customers can cancel orders
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Pickup Slot
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Cancellation Deadline
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Notice (EN)
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
                  Order
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{rule.pickup_label_en}</p>
                    <p className="text-xs text-gray-500">{rule.pickup_label_th}</p>
                    {rule.pickup_label_zh && (
                      <p className="text-xs text-gray-400">{rule.pickup_label_zh}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 text-xs font-semibold rounded-full border border-amber-200">
                      {rule.cutoff_day} at {rule.cutoff_time}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                    <span className="line-clamp-2">{rule.notice_en}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {rule.sort_order}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        rule.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openEdit(rule)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 font-medium rounded hover:bg-blue-100 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      {rule.is_active && (
                        <button
                          onClick={() => handleDeactivate(rule.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-600 font-medium rounded hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export async function getAllCancellationCutoffRules(): Promise<CancellationCutoffRule[]> {
  const { data, error } = await supabase
    .from('cancellation_cutoff_rules')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}
