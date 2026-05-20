import { useEffect } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor, pointerWithin } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { Toaster } from 'react-hot-toast';
import { differenceInCalendarDays, parseISO, addDays, format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { usePlannerStore } from './store';
import { updateAssignment, createAssignment } from './api';
import SourcePanel from './components/SourcePanel';
import TechTimeline from './components/TechTimeline';
import SummaryPanel from './components/SummaryPanel';
import AssignmentModal from './components/AssignmentModal';
import CustomJobModal from './components/CustomJobModal';
import BlockDetailModal from './components/BlockDetailModal';
import HolidayModal from './components/HolidayModal';
import type { SourceCard, Assignment } from './types';

export default function App() {
  const { bootstrap, loading, error, openAssignModal } = usePlannerStore();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const overData = over.data.current as { technicianId?: string; dayStr?: string } | undefined;
    if (!overData?.technicianId || !overData?.dayStr) return;

    // Compute actual pointer position at drop time and derive the date
    // from the timeline grid geometry (pointer-based, not collision-based)
    const initEvt = event.activatorEvent as PointerEvent;
    const pointerX = initEvt.clientX + event.delta.x;
    const { timelineStartDate: tlStart, timelineRange: tlRange } = usePlannerStore.getState();
    let realDayStr = overData.dayStr;
    let realTechId = overData.technicianId;

    // Find the timeline grid container and calculate day from pointer X
    const grid = document.querySelector('[data-timeline-grid]') as HTMLElement | null;
    if (grid) {
      const rect = grid.getBoundingClientRect();
      const relX = pointerX - rect.left - 180; // 180px = technician name column
      const cellWidth = (rect.width - 180) / tlRange;
      const colIdx = Math.floor(relX / cellWidth);
      if (colIdx >= 0 && colIdx < tlRange) {
        realDayStr = format(addDays(tlStart, colIdx), 'yyyy-MM-dd');
      }
    }

    const activeData = active.data.current as { card?: SourceCard; assignment?: Assignment; type?: string } | undefined;

    // ─── Existing block dragged to a new cell ───
    if (activeData?.type === 'block' && activeData.assignment) {
      const a = activeData.assignment;
      const oldTechId = typeof a.technician_id === 'string' ? a.technician_id : a.technician_id._id;
      const oldStart = a.start_date.slice(0, 10);
      const newTechId = realTechId;
      const newStartStr = realDayStr;

      const dayOffset = differenceInCalendarDays(parseISO(newStartStr), parseISO(oldStart));

      if (oldTechId !== newTechId || dayOffset !== 0) {
        usePlannerStore.getState().moveAssignment(a._id, newTechId, dayOffset);
        const duration = differenceInCalendarDays(parseISO(a.end_date.slice(0, 10)), parseISO(oldStart));
        const newStart = parseISO(newStartStr);
        const newEnd = addDays(newStart, duration);
        updateAssignment(a._id, {
          technician_id: newTechId,
          start_date: format(newStart, 'yyyy-MM-dd'),
          end_date: format(newEnd, 'yyyy-MM-dd'),
        }).catch(() => {});
      }
      return;
    }

    // ─── Source card dragged onto timeline ───
    if (activeData?.card) {
      const card = activeData.card;

      // Day off — create directly without opening assignment modal
      if (card.type === 'dayoff') {
        const store = usePlannerStore.getState();
        store.pushUndo('Add day off');
        try {
          const created = await createAssignment({
            technician_id: realTechId,
            title: 'Day Off',
            description: '',
            bay: '',
            start_date: realDayStr,
            end_date: realDayStr,
            source_type: 'dayoff',
            priority: 'low',
            is_rush: false,
            notes: '',
            tags: [],
            estimated_hours: 0,
            color: '',
          });
          usePlannerStore.setState((s) => ({
            assignments: [...s.assignments, created],
          }));
        } catch {
          // Undo on failure
          store.undo();
        }
        return;
      }

      openAssignModal({
        technician_id: realTechId,
        title: card.title,
        start_date: realDayStr,
        end_date: realDayStr,
        source_type: card.type,
        equipment_id: card.type === 'equipment' ? card.id : null,
        priority: card.customJob?.priority || 'medium',
        estimated_hours: card.customJob?.estimated_hours || 0,
        tags: card.customJob?.tags || [],
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fff7f2' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading planner data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-700 font-semibold mb-2">Failed to load</p>
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={bootstrap} className="mt-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      <div className="min-h-screen flex flex-col p-4 gap-4">
        {/* Header */}
        <header className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-orange-100 px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-orange-500" />
              Pre-Planner
            </h1>
            <p className="text-sm text-gray-500">
              Drag equipment & tasks onto technician timelines to schedule work
            </p>
          </div>
        </header>

        {/* Source panel (draggable items) */}
        <SourcePanel />

        {/* Main area: timeline + summary */}
        <div className="flex gap-4 flex-1 min-h-0">
          <TechTimeline />
          <SummaryPanel />
        </div>
      </div>

      {/* Modals */}
      <AssignmentModal />
      <CustomJobModal />
      <BlockDetailModal />
      <HolidayModal />
      <Toaster position="bottom-right" />
    </DndContext>
  );
}
