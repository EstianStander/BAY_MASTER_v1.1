import { useState } from 'react';
import { X, CalendarOff, Trash2, Plus } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { usePlannerStore } from '../store';
import toast from 'react-hot-toast';

export default function HolidayModal() {
  const { holidayModalOpen, closeHolidayModal, holidays, addHoliday, removeHoliday } = usePlannerStore();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  if (!holidayModalOpen) return null;

  const today = startOfDay(new Date());

  // Split holidays into upcoming and past
  const upcoming = holidays.filter((h) => !isBefore(parseISO(h.date.slice(0, 10)), today));
  const past = holidays.filter((h) => isBefore(parseISO(h.date.slice(0, 10)), today));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date) {
      toast.error('Holiday name and date are required');
      return;
    }
    setSaving(true);
    try {
      await addHoliday(name.trim(), date);
      toast.success(`Holiday "${name.trim()}" added`);
      setName('');
      setDate('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add holiday';
      if (msg.includes('409') || msg.includes('already exists')) {
        toast.error('A holiday already exists on this date');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string, holidayName: string) => {
    try {
      await removeHoliday(id);
      toast.success(`Removed "${holidayName}"`);
    } catch {
      toast.error('Failed to remove holiday');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeHolidayModal}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-rose-500" />
            Manage Holidays
          </h2>
          <button onClick={closeHolidayModal} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Add form */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Holiday name…"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
          />
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </form>

        {/* Holiday list */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {upcoming.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Upcoming Holidays
              </h3>
              <div className="space-y-1.5 mb-4">
                {upcoming.map((h) => (
                  <div
                    key={h._id}
                    className="flex items-center justify-between px-3 py-2 bg-rose-50 border border-rose-100 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-rose-600 w-24">
                        {format(parseISO(h.date.slice(0, 10)), 'EEE, d MMM')}
                      </span>
                      <span className="text-sm text-gray-800">{h.name}</span>
                      {h.source === 'system' && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                          🇿🇦 SA
                        </span>
                      )}
                    </div>
                    {h.source !== 'system' && (
                      <button
                        onClick={() => handleRemove(h._id, h.name)}
                        className="p-1 hover:bg-rose-100 rounded text-rose-400 hover:text-rose-600"
                        title="Remove holiday"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {past.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Past Holidays
              </h3>
              <div className="space-y-1.5">
                {past.map((h) => (
                  <div
                    key={h._id}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-500 w-24">
                        {format(parseISO(h.date.slice(0, 10)), 'EEE, d MMM')}
                      </span>
                      <span className="text-sm text-gray-600">{h.name}</span>
                      {h.source === 'system' && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                          🇿🇦 SA
                        </span>
                      )}
                    </div>
                    {h.source !== 'system' && (
                      <button
                        onClick={() => handleRemove(h._id, h.name)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                        title="Remove holiday"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {holidays.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">
              South African holidays load automatically. You can also add your own above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
