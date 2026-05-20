import { CalendarCheck, Warehouse, Users, Undo2, Save } from 'lucide-react';
import { usePlannerStore } from '../store';
import toast from 'react-hot-toast';
import * as api from '../api';

export default function SummaryPanel() {
  const {
    getSummary,
    undoStack,
    undo,
    hasUnsavedChanges,
    assignments,
  } = usePlannerStore();

  const { scheduled, baysInUse, totalBays, overloadedTechs } = getSummary();

  const handleSaveAll = async () => {
    try {
      await api.bulkSaveAssignments(assignments);
      usePlannerStore.setState({ hasUnsavedChanges: false });
      toast.success('All changes saved');
    } catch {
      toast.error('Failed to save changes');
    }
  };

  return (
    <aside className="w-64 shrink-0 space-y-3">
      {/* Summary cards */}
      <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-4 space-y-4">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Summary</h3>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{scheduled}</p>
            <p className="text-xs text-gray-500">Jobs Scheduled</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <Warehouse className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">
              {baysInUse} <span className="text-sm font-normal text-gray-400">/ {totalBays}</span>
            </p>
            <p className="text-xs text-gray-500">Bays In Use</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${overloadedTechs > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <Users className={`w-5 h-5 ${overloadedTechs > 0 ? 'text-red-600' : 'text-gray-500'}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${overloadedTechs > 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {overloadedTechs}
            </p>
            <p className="text-xs text-gray-500">Techs &gt;80% Loaded</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        {hasUnsavedChanges && (
          <button
            onClick={handleSaveAll}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        )}

        <button
          onClick={undo}
          disabled={undoStack.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Undo2 className="w-4 h-4" />
          Undo{undoStack.length > 0 ? ` (${undoStack.length})` : ''}
        </button>
      </div>
    </aside>
  );
}
