import { X, Trash2, ArrowRightCircle, Calendar, MapPin, User, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import toast from 'react-hot-toast';
import { usePlannerStore } from '../store';
import type { Assignment } from '../types';

function techName(a: Assignment): string {
  if (typeof a.technician_id === 'object' && a.technician_id) return a.technician_id.name;
  const tech = usePlannerStore.getState().technicians.find((t) => t._id === a.technician_id);
  return tech?.name ?? 'Unknown';
}

function techNameRaw(a: Assignment): string {
  if (typeof a.technician_id === 'object' && a.technician_id) return a.technician_id.name;
  return '';
}

function bayLabel(bay: string): string {
  const n = parseInt(bay, 10);
  if (n >= 1 && n <= 6) return `Bay ${n}`;
  return bay;
}

function priorityBadge(p: string) {
  const cls =
    p === 'high'
      ? 'bg-red-100 text-red-700'
      : p === 'medium'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-green-100 text-green-700';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{p}</span>;
}

export default function BlockDetailModal() {
  const { blockDetailOpen, blockDetailAssignment, closeBlockDetail, deleteAssignment } =
    usePlannerStore();

  if (!blockDetailOpen || !blockDetailAssignment) return null;

  const a = blockDetailAssignment;
  const startDate = parseISO(a.start_date);
  const endDate = parseISO(a.end_date);
  const durationDays = differenceInCalendarDays(endDate, startDate) + 1;
  const bayNum = parseInt(a.bay, 10);
  const canAssignToBay = a.source_type !== 'dayoff' && bayNum >= 1 && bayNum <= 6;
  const isDayOff = a.source_type === 'dayoff';

  const handleCancel = async () => {
    const confirmMsg = isDayOff
      ? 'Remove this day off from the schedule?'
      : 'Are you sure you want to cancel this job? It will be removed from the schedule.';
    if (!window.confirm(confirmMsg)) return;
    try {
      await deleteAssignment(a._id);
      toast.success(isDayOff ? 'Day off removed' : 'Job cancelled');
      closeBlockDetail();
    } catch {
      toast.error(isDayOff ? 'Failed to remove day off' : 'Failed to cancel job');
    }
  };

  const handleAssignToBay = () => {
    const params = new URLSearchParams({
      source: 'preplanned',
      bay: a.bay,
      projectName: a.title,
      startDate: a.start_date.slice(0, 10),
      endDate: a.end_date.slice(0, 10),
      technicianName: techNameRaw(a),
    });
    window.location.href = `/manage?${params.toString()}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeBlockDetail}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 flex items-start justify-between ${isDayOff ? 'bg-gradient-to-r from-rose-500 to-rose-600' : 'bg-gradient-to-r from-orange-500 to-orange-600'}`}>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">{a.title}</h3>
            {!isDayOff && <p className="text-orange-100 text-sm mt-0.5">{bayLabel(a.bay)}</p>}
            {isDayOff && <p className="text-rose-100 text-sm mt-0.5">Scheduled day off</p>}
          </div>
          <button onClick={closeBlockDetail} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          {/* Technician */}
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-700 font-medium">{techName(a)}</span>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-700">
              {format(startDate, 'dd MMM yyyy')} → {format(endDate, 'dd MMM yyyy')}
              <span className="text-gray-400 ml-1">({durationDays} day{durationDays !== 1 ? 's' : ''})</span>
            </span>
          </div>

          {/* Bay */}
          {!isDayOff && a.bay && (
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700">{bayLabel(a.bay)}</span>
            </div>
          )}

          {/* Hours */}
          {!isDayOff && a.estimated_hours > 0 && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700">{a.estimated_hours}h estimated</span>
            </div>
          )}

          {/* Priority + Rush */}
          {!isDayOff && (
            <div className="flex items-center gap-3">
              {priorityBadge(a.priority)}
            {a.is_rush && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Rush
              </span>
            )}
          </div>
          )}

          {/* Notes */}
          {a.notes && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 mt-2">
              {a.notes}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold
              text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {isDayOff ? 'Remove Day Off' : 'Cancel Job'}
          </button>
          {canAssignToBay && (
            <button
              onClick={handleAssignToBay}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold
                text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
            >
              <ArrowRightCircle className="w-4 h-4" />
              Assign to Bay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
