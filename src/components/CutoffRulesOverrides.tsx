import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { PickupOverride } from '../lib/availabilityService';

interface CutoffRulesOverridesProps {
  overrides: PickupOverride[];
  onRefresh: () => void;
}

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const locations = ['Mae Rim', 'In-Town'];
const pickupDays = ['Friday', 'Saturday', 'Sunday'];
const overrideTypes = [
  { value: 'closed', label: 'Closed' },
  { value: 'custom_cutoff', label: 'Custom Cutoff' },
  { value: 'sold_out', label: 'Sold Out' },
];

export function CutoffRulesOverrides({ overrides, onRefresh }: CutoffRulesOverridesProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PickupOverride | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    pickup_day: '',
    location: '',
    override_type: 'closed' as const,
    custom_cutoff_day: '',
    custom_cutoff_time: '',
    note_en: '',
    note_th: '',
    is_active: true,
  });

  const handleNew = () => {
    setFormData({
      date: '',
      pickup_day: '',
      location: '',
      override_type: 'closed',
      custom_cutoff_day: '',
      custom_cutoff_time: '',
      note_en: '',
      note_th: '',
      is_active: true,
    });
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (override: PickupOverride) => {
    setFormData({
      date: override.date,
      pickup_day: override.pickup_day,
      location: override.location,
      override_type: override.override_type,
      custom_cutoff_day: override.custom_cutoff_day || '',
      custom_cutoff_time: override.custom_cutoff_time || '',
      note_en: override.note_en,
      note_th: override.note_th,
      is_active: override.is_active,
    });
    setEditing(override);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.date || !formData.pickup_day || !formData.location) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.override_type === 'custom_cutoff') {
      if (!formData.custom_cutoff_day || !formData.custom_cutoff_time) {
        alert('Please specify custom cutoff day and time');
        return;
      }
    }

    try {
      const dataToSave = {
        date: formData.date,
        pickup_day: formData.pickup_day,
        location: formData.location,
        override_type: formData.override_type,
        custom_cutoff_day: formData.override_type === 'custom_cutoff' ? formData.custom_cutoff_day : null,
        custom_cutoff_time: formData.override_type === 'custom_cutoff' ? formData.custom_cutoff_time : null,
        note_en: formData.note_en,
        note_th: formData.note_th,
        is_active: formData.is_active,
      };

      if (editing) {
        const { error } = await supabase
          .from('pickup_overrides')
          .update(dataToSave)
          .eq('id', editing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pickup_overrides')
          .insert([dataToSave]);

        if (error) throw error;
      }

      setShowForm(false);
      setEditing(null);
      onRefresh();
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving override');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      const { error } = await supabase
        .from('pickup_overrides')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      onRefresh();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error deleting override');
    }
  };

  const getOverrideTypeLabel = (type: string): string => {
    const found = overrideTypes.find(t => t.value === type);
    return found ? found.label : type;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Holiday / Special Overrides</h2>
        <button
          onClick={handleNew}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          + Add Override
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editing ? 'Edit Override' : 'New Override'}
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
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
              {pickupDays.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>

            <select
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="">Select Location</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <select
              value={formData.override_type}
              onChange={(e) =>
                setFormData({ ...formData, override_type: e.target.value as any })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              {overrideTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            {formData.override_type === 'custom_cutoff' && (
              <>
                <select
                  value={formData.custom_cutoff_day}
                  onChange={(e) =>
                    setFormData({ ...formData, custom_cutoff_day: e.target.value })
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
                  value={formData.custom_cutoff_time}
                  onChange={(e) =>
                    setFormData({ ...formData, custom_cutoff_time: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
              </>
            )}

            <input
              type="text"
              placeholder="Note in English (optional)"
              value={formData.note_en}
              onChange={(e) =>
                setFormData({ ...formData, note_en: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />

            <input
              type="text"
              placeholder="Note in Thai (optional)"
              value={formData.note_th}
              onChange={(e) =>
                setFormData({ ...formData, note_th: e.target.value })
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
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Pickup / Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Override Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                Details
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
            {overrides.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                  No overrides configured yet.
                </td>
              </tr>
            ) : (
              overrides.map((override) => (
                <tr
                  key={override.id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {override.date}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {override.pickup_day} / {override.location}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {getOverrideTypeLabel(override.override_type)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {override.override_type === 'custom_cutoff' && override.custom_cutoff_day ? (
                      <div>
                        <p>{override.custom_cutoff_day} {override.custom_cutoff_time}</p>
                        {override.note_en && <p className="text-xs text-gray-500">{override.note_en}</p>}
                      </div>
                    ) : (
                      override.note_en || override.note_th || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        override.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {override.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEdit(override)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(override.id)}
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
