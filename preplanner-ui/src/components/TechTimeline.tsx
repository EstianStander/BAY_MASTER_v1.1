import { useRef, useCallback, useState } from 'react';
import { format, addDays, differenceInCalendarDays, parseISO, isWeekend, isToday, isPast, startOfDay } from 'date-fns';
import { AlertTriangle, ChevronLeft, ChevronRight, CalendarDays, GripHorizontal, CalendarOff } from 'lucide-react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { usePlannerStore } from '../store';
import { updateAssignment as apiUpdateAssignment } from '../api';
import type { Assignment, TimelineRange } from '../types';

/* ─── helpers ─── */
function techId(a: Assignment): string {
  return typeof a.technician_id === 'string' ? a.technician_id : a.technician_id._id;
}

function bayColorClass(bay: string): string {
  const n = parseInt(bay, 10);
  if (n >= 1 && n <= 6) return `bay-block-${n}`;
  return 'bay-block-ext';
}

function bayLabel(bay: string): string {
  const n = parseInt(bay, 10);
  if (n >= 1 && n <= 6) return `Bay ${n}`;
  return bay;
}

/* ─── Droppable cell component ─── */
function DayCell({ technicianId, dayStr, dayIdx, isHoliday }: { technicianId: string; dayStr: string; dayIdx: number; isHoliday?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${technicianId}-${dayStr}`,
    data: { technicianId, dayStr, dayIdx },
  });

  return (
    <div
      ref={setNodeRef}
      data-day={dayStr}
      data-tech-id={technicianId}
      className={`border-r border-b border-gray-100 min-h-[56px] transition-colors
        ${isOver ? 'bg-orange-50' : isHoliday ? 'bg-rose-50/40' : ''}`}
    />
  );
}

/* ─── Draggable + Resizable assignment block ─── */
function DraggableBlock({
  assignment,
  techIdx,
  startCol,
  span,
  timelineRange,
  timelineStartDate: _timelineStartDate,
  hasTechConflict,
  hasBayConflict,
  onClick,
  onDoubleClick,
}: {
  assignment: Assignment;
  techIdx: number;
  startCol: number;
  span: number;
  timelineRange: number;
  timelineStartDate: Date;
  hasTechConflict: boolean;
  hasBayConflict: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `block-${assignment._id}`,
    data: { assignment, type: 'block' },
  });

  const [resizeDelta, setResizeDelta] = useState<{ edge: 'left' | 'right'; days: number } | null>(null);
  const resizeRef = useRef<{ edge: 'left' | 'right'; startX: number; cellPx: number; lastDays: number } | null>(null);

  const cellWidth = `calc((100% - 180px) / ${timelineRange})`;

  // Adjust for active resize
  const adjustedStartCol = resizeDelta?.edge === 'left' ? startCol + resizeDelta.days : startCol;
  const adjustedSpan = resizeDelta
    ? resizeDelta.edge === 'left'
      ? span - resizeDelta.days
      : span + resizeDelta.days
    : span;
  const clampedSpan = Math.max(adjustedSpan, 1);
  const clampedStartCol = adjustedSpan < 1 ? startCol + span - 1 : adjustedStartCol;

  const leftPx = `calc(180px + ${clampedStartCol} * ${cellWidth})`;
  const widthPx = `calc(${clampedSpan} * ${cellWidth})`;

  const dragStyle = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : {};

  const handleResizeStart = (edge: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Measure actual cell width in pixels from the grid container
    let el: HTMLElement | null = e.currentTarget as HTMLElement;
    while (el && !el.classList.contains('min-w-[900px]')) el = el.parentElement;
    const containerWidth = el ? el.clientWidth : 900;
    const cellPx = (containerWidth - 180) / timelineRange;

    resizeRef.current = { edge, startX: e.clientX, cellPx, lastDays: 0 };
    setResizeDelta({ edge, days: 0 });

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.startX;
      const daysDelta = Math.round(dx / resizeRef.current.cellPx);
      resizeRef.current.lastDays = daysDelta;
      setResizeDelta({ edge: resizeRef.current.edge, days: daysDelta });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      if (resizeRef.current) {
        const ref = resizeRef.current;
        const finalDays = ref.lastDays;
        setResizeDelta(null);
        resizeRef.current = null;

        if (finalDays === 0) return;

        // Compute final dates
        const aStart = parseISO(assignment.start_date.slice(0, 10));
        const aEnd = parseISO(assignment.end_date.slice(0, 10));

        let newStart = aStart;
        let newEnd = aEnd;

        if (ref.edge === 'left') {
          newStart = addDays(aStart, finalDays);
          if (newStart > newEnd) newStart = newEnd;
        } else {
          newEnd = addDays(aEnd, finalDays);
          if (newEnd < newStart) newEnd = newStart;
        }

        const newStartStr = format(newStart, 'yyyy-MM-dd');
        const newEndStr = format(newEnd, 'yyyy-MM-dd');

        usePlannerStore.getState().resizeAssignment(assignment._id, newStartStr, newEndStr);
        apiUpdateAssignment(assignment._id, {
          start_date: newStartStr,
          end_date: newEndStr,
        }).catch(() => {});
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const isResizing = resizeDelta !== null;
  const isDayOff = assignment.source_type === 'dayoff';

  return (
    <div
      ref={setNodeRef}
      className={`absolute rounded-md text-white text-[11px] font-semibold
        select-none shadow-sm hover:brightness-110 transition-shadow overflow-visible group
        ${isDayOff ? 'bg-rose-400' : bayColorClass(assignment.bay)}
        ${!isDayOff && assignment.is_rush ? 'ring-2 ring-red-400' : ''}
        ${hasTechConflict ? 'conflict-tech' : ''}
        ${hasBayConflict ? 'conflict-bay' : ''}
        ${isDragging ? 'opacity-50 ring-2 ring-orange-400 z-50 shadow-xl' : ''}
        ${isResizing ? 'z-40 ring-2 ring-orange-400' : ''}`}
      style={{
        top: `${techIdx * 56 + 4}px`,
        height: '48px',
        left: leftPx,
        width: widthPx,
        pointerEvents: 'auto',
        zIndex: isDragging ? 50 : isResizing ? 40 : 1,
        ...(isDayOff ? { background: 'repeating-linear-gradient(45deg, #fb7185, #fb7185 6px, #f43f5e 6px, #f43f5e 12px)' } : {}),
        ...dragStyle,
      }}
      onClick={(e: React.MouseEvent) => { if (!isResizing) { e.stopPropagation(); onClick(); } }}
      onDoubleClick={onDoubleClick}
      title={isDayOff
        ? `${assignment.title}\n${assignment.start_date.slice(0, 10)} → ${assignment.end_date.slice(0, 10)}\n\nDrag to move · Drag edges to resize`
        : `${assignment.title}\n${bayLabel(assignment.bay)}\n${assignment.start_date.slice(0, 10)} → ${assignment.end_date.slice(0, 10)}${hasTechConflict ? '\n⚠ Technician overlap!' : ''}${hasBayConflict ? '\n⚠ Bay double-booked!' : ''}\n\nClick to view · Double-click to edit · Drag to move · Drag edges to resize`}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10
          opacity-0 group-hover:opacity-100 transition-opacity
          bg-white/30 rounded-l-md hover:bg-white/50"
        onMouseDown={(e) => handleResizeStart('left', e)}
      />

      {/* Content — attach dnd-kit drag listeners only to the center */}
      <div
        className="flex items-center gap-1 px-3 cursor-grab overflow-hidden flex-1 h-full"
        {...listeners}
        {...attributes}
      >
        {isDayOff
          ? <CalendarOff className="w-3 h-3 opacity-80 shrink-0" />
          : <GripHorizontal className="w-3 h-3 opacity-60 shrink-0" />
        }
        <span className="truncate">{assignment.title}</span>
        {!isDayOff && <span className="opacity-75 text-[10px] shrink-0">{bayLabel(assignment.bay)}</span>}
        {(hasTechConflict || hasBayConflict) && (
          <AlertTriangle className="w-3 h-3 text-yellow-200 shrink-0" />
        )}
      </div>

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10
          opacity-0 group-hover:opacity-100 transition-opacity
          bg-white/30 rounded-r-md hover:bg-white/50"
        onMouseDown={(e) => handleResizeStart('right', e)}
      />
    </div>
  );
}

/* ─── Main TechTimeline component ─── */
export default function TechTimeline() {
  const {
    technicians,
    assignments,
    holidays,
    timelineRange,
    timelineStartDate,
    setTimelineRange,
    scrollTimeline,
    jumpToToday,
    jumpToDate,
    openAssignModal,
    openBlockDetail,
    getConflicts,
    getHolidayDates,
  } = usePlannerStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  const days: Date[] = [];
  for (let i = 0; i < timelineRange; i++) {
    days.push(addDays(timelineStartDate, i));
  }

  const { techConflicts, bayConflicts } = getConflicts();
  const holidayDates = getHolidayDates();

  // Build a lookup: date string -> holiday name
  const holidayNameMap = new Map<string, string>();
  holidays.forEach((h) => {
    holidayNameMap.set(h.date.slice(0, 10), h.name);
  });

  const handleBlockDoubleClick = useCallback(
    (a: Assignment) => {
      openAssignModal(
        {
          technician_id: techId(a),
          title: a.title,
          description: a.description,
          bay: a.bay,
          start_date: a.start_date.slice(0, 10),
          end_date: a.end_date.slice(0, 10),
          priority: a.priority,
          is_rush: a.is_rush,
          notes: a.notes,
          tags: a.tags,
          estimated_hours: a.estimated_hours,
          source_type: a.source_type,
          equipment_id: typeof a.equipment_id === 'object' && a.equipment_id ? a.equipment_id._id : a.equipment_id,
          color: a.color,
        },
        a._id
      );
    },
    [openAssignModal]
  );

  const rangeButtons: TimelineRange[] = [7, 14, 30, 60];

  return (
    <section className="bg-white rounded-xl shadow-sm border border-orange-100 flex-1 flex flex-col overflow-hidden">
      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800">Technician Timelines</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => scrollTimeline(-timelineRange)} className="p-1.5 hover:bg-orange-50 rounded-lg" title="Previous period">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={jumpToToday}
            className="flex items-center gap-1 text-sm font-medium text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg"
          >
            <CalendarDays className="w-4 h-4" /> Today
          </button>
          <button onClick={() => scrollTimeline(timelineRange)} className="p-1.5 hover:bg-orange-50 rounded-lg" title="Next period">
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Date picker to jump to any date */}
          <input
            type="date"
            value={format(timelineStartDate, 'yyyy-MM-dd')}
            onChange={(e) => {
              const d = e.target.value;
              if (d) jumpToDate(parseISO(d));
            }}
            className="ml-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-orange-300 focus:ring-1 focus:ring-orange-200 outline-none"
            title="Jump to a specific date"
          />

          <div className="ml-2 flex border border-gray-200 rounded-lg overflow-hidden">
            {rangeButtons.map((r) => (
              <button
                key={r}
                onClick={() => setTimelineRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors
                  ${timelineRange === r ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto custom-scrollbar">
        <div className="min-w-[900px]" data-timeline-grid>
          {/* Header row: dates */}
          <div
            className="grid sticky top-0 z-10 bg-gray-50 border-b border-gray-200"
            style={{ gridTemplateColumns: `180px repeat(${timelineRange}, 1fr)` }}
          >
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-r border-gray-200">
              Technician
            </div>
            {days.map((day) => {
              const isWknd = isWeekend(day);
              const isTdy = isToday(day);
              const dayStr = format(day, 'yyyy-MM-dd');
              const isHoliday = holidayDates.has(dayStr);
              const holidayName = holidayNameMap.get(dayStr);
              const isPastDay = isPast(addDays(startOfDay(day), 1)); // day is fully in the past
              return (
                <div
                  key={day.toISOString()}
                  className={`px-1 py-2 text-center text-[11px] border-r border-gray-100 relative
                    ${isHoliday ? 'bg-rose-50 text-rose-600' : isWknd ? 'bg-gray-100 text-gray-400' : 'text-gray-600'}
                    ${isTdy ? 'bg-orange-50 font-bold text-orange-700' : ''}
                    ${isPastDay && !isTdy && !isHoliday ? 'bg-gray-50/70 text-gray-400' : ''}`}
                  title={holidayName || (isPastDay ? 'Past' : undefined)}
                >
                  <div>{format(day, 'EEE')}</div>
                  <div className="font-semibold">{format(day, 'd')}</div>
                  <div className="text-[9px]">{format(day, 'MMM')}</div>
                  {isHoliday && (
                    <div className="text-[8px] font-bold text-rose-500 truncate leading-tight mt-0.5" title={holidayName}>
                      {holidayName}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Technician rows */}
          {technicians.map((tech) => {
            return (
              <div
                key={tech._id}
                className="grid border-b border-gray-100"
                style={{ gridTemplateColumns: `180px repeat(${timelineRange}, 1fr)` }}
              >
                {/* Tech name */}
                <div className="px-3 py-2 flex items-center gap-2 border-r border-gray-200 bg-gray-50/50 sticky left-0 z-[5]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {tech.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <span className="text-sm font-medium text-gray-700 truncate">{tech.name}</span>
                </div>

                {/* Day cells — droppable targets */}
                {days.map((day, idx) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  return (
                    <DayCell
                      key={dayStr}
                      technicianId={tech._id}
                      dayStr={dayStr}
                      dayIdx={idx}
                      isHoliday={holidayDates.has(dayStr)}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Assignment block overlays — positioned absolutely over the grid */}
          <div className="relative" style={{ marginTop: `-${technicians.length * 56}px`, pointerEvents: 'none' }}>
            {technicians.map((tech, techIdx) => {
              const techAssignments = assignments.filter((a) => techId(a) === tech._id);
              return techAssignments.map((a) => {
                const aStart = parseISO(a.start_date.slice(0, 10));
                const aEnd = parseISO(a.end_date.slice(0, 10));
                const rangeStart = timelineStartDate;
                const rangeEnd = addDays(rangeStart, timelineRange - 1);
                if (aEnd < rangeStart || aStart > rangeEnd) return null;

                const visibleStart = aStart < rangeStart ? rangeStart : aStart;
                const visibleEnd = aEnd > rangeEnd ? rangeEnd : aEnd;
                const startCol = differenceInCalendarDays(visibleStart, rangeStart);
                const span = differenceInCalendarDays(visibleEnd, visibleStart) + 1;

                return (
                  <DraggableBlock
                    key={a._id}
                    assignment={a}
                    techIdx={techIdx}
                    startCol={startCol}
                    span={span}
                    timelineRange={timelineRange}
                    timelineStartDate={rangeStart}
                    hasTechConflict={techConflicts.has(a._id)}
                    hasBayConflict={bayConflicts.has(a._id)}
                    onClick={() => openBlockDetail(a)}
                    onDoubleClick={() => handleBlockDoubleClick(a)}
                  />
                );
              });
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
