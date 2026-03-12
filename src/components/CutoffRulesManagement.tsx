import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CutoffRule } from '../lib/availabilityService';

interface CutoffRulesManagementProps {
  rules: CutoffRule[];
  onRefresh: () => void;
}

export function CutoffRulesManagement({ rules, onRefresh }: CutoffRulesManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CutoffRule | null>(null);
  const [formData, setFormData] = useState({
    pickup_label_en: '',
    pickup_label_th: '',
    pickup_day: '',
    location: '',
    cutoff_day: '',
    cutoff_time: '',
    is_active: true,
    sort_order: 0,
  });

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handleNew = () => {
    setFormData({
      pickup_label_en: '',
      pickup_label_th: '',
      pickup_day: '',
      location: '',
      cutoff_day: '',
      cutoff_time: '17:00',
      is_active: true,
      sort_order: rules.length + 1,
    });
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (rule: CutoffRule) => {
    setFormData({
      pickup_label_en: rule.pickup_label_en,
      pickup_label_th: rule.pickup_label_th,
      pickup_day: rule.pickup_day,
      location: rule.location,
      cutoff_day: rule.cutoff_day,
      cutoff_time: rule.cutoff_time,
      is_active: rule.is_active,
      sort_order: rule.sort_order,
    });
    setEditing(rule);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.pickup_label_en || !formData.pickup_day || !formData.cutoff_day) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editing) {
        const { error } = await supabase
          .from('pickup_cutoff_rules')
          .update(formData)
          .eq('id', editing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pickup_cutoff_rules')
          .insert([formData]);

        if (error) throw error;
      }

      setShowForm(false);
      setEditing(null);
      onRefresh();
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      const { error } = await supabase
        .from('pickup_cutoff_rules')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      onRefresh();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error deleting rule');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Pickup Cutoff Rules</h2>
        <button
          onClick={handleNew}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          + Add Rule
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editing ? 'Edit Rule' : 'New Rule'}
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="English Label (e.g., Friday – Mae Rim)"
              value={formData.pickup_label_en}
              onChange={(e) =>
                setFormData({ ...formData, pickup_label_en: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />

            <input
              type="text"
              placeholder="Thai Label (e.g., วันศุกร์ – แม่ริม)"
              value={formData.pickup_label_th}
              onChange={(e) =>
                setFormData({ ...formData, pickup_label_th: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />

            <select
              value={formData.pickup_day}
              onChange={(e) =>
                setFormData({ ...formData, pickup_day: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="">Select Pickup Day</option>
              {days.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Location (e.g., Mae Rim)"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />

            <select
              value={formData.cutoff_day}
              onChange={(e) =>
                setFormData({ ...formData, cutoff_day: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="">Select Cutoff Day</option>
              {days.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>

            <input
              type="time"
              value={formData.cutoff_time}
              onChange={(e) =>
                setFormData({ ...formData, cutoff_time: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />

            <input
              type="number"
              placeholder="Sort Order"
              value={formData.sort_order}
              onChange={(e) =>
                setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />

            <label className="flex items-center gap-2 text-gray-700 font-medium">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              Active
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Save
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Pickup Day
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Cutoff
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
            {rules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                  No rules configured yet.
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {rule.pickup_label_en}
                      </p>
                      <p className="text-xs text-gray-600">{rule.pickup_label_th}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{rule.location}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {rule.cutoff_day} {rule.cutoff_time}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {rule.sort_order}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        rule.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
