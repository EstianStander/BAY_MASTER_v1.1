import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { usePlannerStore } from '../store';
import type { AssignmentFormData } from '../types';
import toast from 'react-hot-toast';

const BAY_OPTIONS = ['1', '2', '3', '4', '5', '6', 'External'];

export default function AssignmentModal() {
  const {
    assignModalOpen,
    assignModalData,
    editingAssignmentId,
    closeAssignModal,
    submitAssignment,
    deleteAssignment,
    technicians,
  } = usePlannerStore();

  const [form, setForm] = useState<AssignmentFormData>({
    technician_id: '',
    title: '',
    description: '',
    bay: '1',
    start_date: '',
    end_date: '',
    priority: 'medium',
    is_rush: false,
    notes: '',
    tags: [],
    estimated_hours: 0,
    source_type: 'custom',
    equipment_id: null,
    color: '',
  });

  const [customBay, setCustomBay] = useState('');
  const [useCustomBay, setUseCustomBay] = useState(false);
  const [saving, setSaving] = useState(false);

  // Populate form when modal opens
  useEffect(() => {
    if (assignModalOpen && assignModalData) {
      const data = assignModalData;
      const bayIsStandard = BAY_OPTIONS.includes(data.bay || '');
      setForm({
        technician_id: data.technician_id || (technicians[0]?._id ?? ''),
        title: data.title || '',
        description: data.description || '',
        bay: bayIsStandard ? (data.bay || '1') : '1',
        start_date: data.start_date || '',
        end_date: data.end_date || data.start_date || '',
        priority: data.priority || 'medium',
        is_rush: data.is_rush ?? false,
        notes: data.notes || '',
        tags: data.tags || [],
        estimated_hours: data.estimated_hours || 0,
        source_type: data.source_type || 'custom',
        equipment_id: data.equipment_id || null,
        color: data.color || '',
      });
      if (!bayIsStandard && data.bay) {
        setUseCustomBay(true);
        setCustomBay(data.bay);
      } else {
        setUseCustomBay(false);
        setCustomBay('');
      }
    }
  }, [assignModalOpen, assignModalData, technicians]);

  if (!assignModalOpen) return null;

  const isEditing = Boolean(editingAssignmentId);

  const update = <K extends keyof AssignmentFormData>(key: K, value: AssignmentFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalBay = useCustomBay ? customBay.trim() : form.bay;
    if (form.source_type !== 'dayoff' && !finalBay) { toast.error('Bay is required'); return; }
    if (!form.technician_id) { toast.error('Select a technician'); return; }
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.start_date || !form.end_date) { toast.error('Start and end dates required'); return; }
    if (form.end_date < form.start_date) { toast.error('End date must be ≥ start date'); return; }

    setSaving(true);
    try {
      await submitAssignment({ ...form, bay: finalBay, title: form.title.trim() });
      toast.success(isEditing ? 'Assignment updated' : 'Assignment created');
    } catch {
      toast.error('Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingAssignmentId) return;
    if (!window.confirm('Delete this assignment?')) return;
    try {
      await deleteAssignment(editingAssignmentId);
      toast.success('Assignment deleted');
      closeAssignModal();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeAssignModal}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">
            {isEditing ? 'Edit Assignment' : 'New Assignment'}
          </h3>
          <button onClick={closeAssignModal} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
            <input
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Technician + Bay */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Technician</label>
              <select
                value={form.technician_id}
                onChange={(e) => update('technician_id', e.target.value)}
                className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">Select…</option>
                {technicians.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Bay</label>
              {useCustomBay ? (
                <div className="flex gap-1">
                  <input
                    value={customBay}
                    onChange={(e) => setCustomBay(e.target.value)}
                    placeholder="Custom bay name"
                    className="flex-1 border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <button type="button" onClick={() => setUseCustomBay(false)} className="text-xs text-orange-600 hover:underline">
                    List
                  </button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <select
                    value={form.bay}
                    onChange={(e) => update('bay', e.target.value)}
                    className="flex-1 border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {BAY_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b === 'External' ? 'External' : `Bay ${b}`}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setUseCustomBay(true)} className="text-xs text-orange-600 hover:underline whitespace-nowrap">
                    Custom
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => update('start_date', e.target.value)}
                className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={form.end_date}
                min={form.start_date}
                onChange={(e) => update('end_date', e.target.value)}
                className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          {/* Priority + Rush */}
          <div className="flex items-center gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => update('priority', e.target.value as 'low' | 'medium' | 'high')}
                className="border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <label className="flex items-center gap-2 mt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_rush}
                onChange={(e) => update('is_rush', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-400"
              />
              <span className="text-sm font-medium text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Rush Job
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeAssignModal}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving…' : isEditing ? 'Update' : 'Assign'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
