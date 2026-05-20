import { create } from 'zustand';
import { addDays, format, differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import type {
  Technician,
  EquipmentItem,
  CustomJob,
  Assignment,
  SourceCard,
  UndoEntry,
  TimelineRange,
  FilterMode,
  AssignmentFormData,
  Holiday,
} from './types';
import * as api from './api';

interface PlannerState {
  // ─── Data ───
  technicians: Technician[];
  equipment: EquipmentItem[];
  customJobs: CustomJob[];
  assignments: Assignment[];
  holidays: Holiday[];
  loading: boolean;
  error: string | null;

  // ─── UI State ───
  timelineRange: TimelineRange;
  filterMode: FilterMode;
  searchQuery: string;
  timelineStartDate: Date;

  // ─── Modal ───
  assignModalOpen: boolean;
  assignModalData: Partial<AssignmentFormData> | null;
  editingAssignmentId: string | null;

  // ─── Custom job modal ───
  customJobModalOpen: boolean;

  // ─── Block detail modal ───
  blockDetailOpen: boolean;
  blockDetailAssignment: Assignment | null;

  // ─── Holiday modal ───
  holidayModalOpen: boolean;

  // ─── Undo ───
  undoStack: UndoEntry[];

  // ─── Dirty tracking ───
  hasUnsavedChanges: boolean;

  // ─── Actions ───
  bootstrap: () => Promise<void>;
  setTimelineRange: (r: TimelineRange) => void;
  setFilterMode: (m: FilterMode) => void;
  setSearchQuery: (q: string) => void;
  jumpToToday: () => void;
  jumpToDate: (date: Date) => void;
  scrollTimeline: (days: number) => void;

  openAssignModal: (data: Partial<AssignmentFormData>, editId?: string | null) => void;
  closeAssignModal: () => void;
  submitAssignment: (data: AssignmentFormData) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;

  moveAssignment: (id: string, newTechId: string, dayOffset: number) => void;
  resizeAssignment: (id: string, newStart: string, newEnd: string) => void;

  openCustomJobModal: () => void;
  closeCustomJobModal: () => void;

  openBlockDetail: (assignment: Assignment) => void;
  closeBlockDetail: () => void;
  createCustomJob: (job: { title: string; description: string; estimated_hours: number; priority: 'low' | 'medium' | 'high'; tags: string[] }) => Promise<void>;
  deleteCustomJob: (id: string) => Promise<void>;

  // ─── Holidays ───
  openHolidayModal: () => void;
  closeHolidayModal: () => void;
  addHoliday: (name: string, date: string) => Promise<void>;
  removeHoliday: (id: string) => Promise<void>;
  getHolidayDates: () => Set<string>;

  autoAssign: (card: SourceCard) => string | null;

  undo: () => void;
  pushUndo: (label: string) => void;

  getSourceCards: () => SourceCard[];
  getConflicts: () => { techConflicts: Set<string>; bayConflicts: Set<string> };
  getSummary: () => { scheduled: number; baysInUse: number; totalBays: number; overloadedTechs: number };
}

const MAX_UNDO = 5;

function techId(a: Assignment): string {
  return typeof a.technician_id === 'string' ? a.technician_id : a.technician_id._id;
}

function rangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 <= e2 && s2 <= e1;
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
  technicians: [],
  equipment: [],
  customJobs: [],
  assignments: [],
  holidays: [],
  loading: false,
  error: null,

  timelineRange: 14,
  filterMode: 'all',
  searchQuery: '',
  timelineStartDate: startOfDay(new Date()),

  assignModalOpen: false,
  assignModalData: null,
  editingAssignmentId: null,

  customJobModalOpen: false,

  blockDetailOpen: false,
  blockDetailAssignment: null,

  holidayModalOpen: false,

  undoStack: [],
  hasUnsavedChanges: false,

  // ─── Bootstrap ───
  bootstrap: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchPlannerData();
      set({
        technicians: data.technicians,
        equipment: data.equipment,
        customJobs: data.customJobs,
        assignments: data.assignments,
        holidays: data.holidays || [],
        loading: false,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load planner data';
      set({ loading: false, error: msg });
    }
  },

  // ─── Timeline controls ───
  setTimelineRange: (r) => set({ timelineRange: r }),
  setFilterMode: (m) => set({ filterMode: m }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  jumpToToday: () => set({ timelineStartDate: startOfDay(new Date()) }),

  jumpToDate: (date) => set({ timelineStartDate: startOfDay(date) }),

  scrollTimeline: (days) =>
    set((s) => ({ timelineStartDate: addDays(s.timelineStartDate, days) })),

  // ─── Assignment Modal ───
  openAssignModal: (data, editId = null) =>
    set({ assignModalOpen: true, assignModalData: data, editingAssignmentId: editId }),

  closeAssignModal: () =>
    set({ assignModalOpen: false, assignModalData: null, editingAssignmentId: null }),

  submitAssignment: async (formData) => {
    const { editingAssignmentId } = get();
    get().pushUndo(editingAssignmentId ? 'Edit assignment' : 'Create assignment');

    try {
      if (editingAssignmentId) {
        const updated = await api.updateAssignment(editingAssignmentId, formData);
        set((s) => ({
          assignments: s.assignments.map((a) => (a._id === editingAssignmentId ? updated : a)),
          hasUnsavedChanges: false,
        }));
      } else {
        const created = await api.createAssignment(formData);
        set((s) => ({
          assignments: [...s.assignments, created],
          hasUnsavedChanges: false,
        }));
      }
      get().closeAssignModal();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      throw new Error(msg);
    }
  },

  deleteAssignment: async (id) => {
    get().pushUndo('Delete assignment');
    await api.deleteAssignment(id);
    set((s) => ({
      assignments: s.assignments.filter((a) => a._id !== id),
      hasUnsavedChanges: false,
    }));
  },

  // ─── Move / Resize (optimistic) ───
  moveAssignment: (id, newTechId, dayOffset) => {
    get().pushUndo('Move assignment');
    set((s) => ({
      assignments: s.assignments.map((a) => {
        if (a._id !== id) return a;
        const newStart = addDays(parseISO(a.start_date), dayOffset);
        const duration = differenceInCalendarDays(parseISO(a.end_date), parseISO(a.start_date));
        const newEnd = addDays(newStart, duration);
        return {
          ...a,
          technician_id: newTechId,
          start_date: format(newStart, 'yyyy-MM-dd'),
          end_date: format(newEnd, 'yyyy-MM-dd'),
        };
      }),
      hasUnsavedChanges: true,
    }));
  },

  resizeAssignment: (id, newStart, newEnd) => {
    get().pushUndo('Resize assignment');
    set((s) => ({
      assignments: s.assignments.map((a) =>
        a._id === id ? { ...a, start_date: newStart, end_date: newEnd } : a
      ),
      hasUnsavedChanges: true,
    }));
  },

  // ─── Custom Job Modal ───
  openCustomJobModal: () => set({ customJobModalOpen: true }),
  closeCustomJobModal: () => set({ customJobModalOpen: false }),

  // ─── Block Detail Modal ───
  openBlockDetail: (assignment) => set({ blockDetailOpen: true, blockDetailAssignment: assignment }),
  closeBlockDetail: () => set({ blockDetailOpen: false, blockDetailAssignment: null }),

  // ─── Holiday Modal ───
  openHolidayModal: () => set({ holidayModalOpen: true }),
  closeHolidayModal: () => set({ holidayModalOpen: false }),

  addHoliday: async (name, date) => {
    const created = await api.createHoliday({ name, date });
    set((s) => ({ holidays: [...s.holidays, created].sort((a, b) => a.date.localeCompare(b.date)) }));
  },

  removeHoliday: async (id) => {
    await api.deleteHoliday(id);
    set((s) => ({ holidays: s.holidays.filter((h) => h._id !== id) }));
  },

  getHolidayDates: () => {
    const { holidays } = get();
    return new Set(holidays.map((h) => h.date.slice(0, 10)));
  },

  createCustomJob: async (job) => {
    const created = await api.createCustomJob(job);
    set((s) => ({ customJobs: [created, ...s.customJobs] }));
    get().closeCustomJobModal();
  },

  deleteCustomJob: async (id) => {
    await api.deleteCustomJob(id);
    set((s) => ({ customJobs: s.customJobs.filter((j) => j._id !== id) }));
  },

  // ─── Auto-assign ───
  autoAssign: (_card) => {
    const { technicians, assignments } = get();
    if (!technicians.length) return null;

    // Find least-loaded technician
    const loadMap = new Map<string, number>();
    technicians.forEach((t) => loadMap.set(t._id, 0));
    assignments.forEach((a) => {
      const tid = techId(a);
      const days = differenceInCalendarDays(parseISO(a.end_date), parseISO(a.start_date)) + 1;
      loadMap.set(tid, (loadMap.get(tid) || 0) + days);
    });

    let minId = technicians[0]._id;
    let minLoad = Infinity;
    for (const [tid, load] of loadMap) {
      if (load < minLoad) {
        minLoad = load;
        minId = tid;
      }
    }
    return minId;
  },

  // ─── Undo ───
  pushUndo: (label) => {
    set((s) => ({
      undoStack: [
        ...s.undoStack.slice(-(MAX_UNDO - 1)),
        { label, snapshot: JSON.parse(JSON.stringify(s.assignments)) },
      ],
    }));
  },

  undo: () => {
    const { undoStack } = get();
    if (!undoStack.length) return;
    const last = undoStack[undoStack.length - 1];
    set({
      assignments: last.snapshot,
      undoStack: undoStack.slice(0, -1),
      hasUnsavedChanges: true,
    });
  },

  // ─── Derived: Source cards ───
  getSourceCards: () => {
    const { equipment, customJobs, filterMode, searchQuery } = get();
    const cards: SourceCard[] = [];
    const q = searchQuery.toLowerCase();

    if (filterMode !== 'custom') {
      equipment.forEach((eq) => {
        const title = `${eq.equipmentId} – ${eq.equipmentName}`;
        if (q && !title.toLowerCase().includes(q) && !eq.customerName.toLowerCase().includes(q)) return;
        cards.push({
          id: eq._id,
          type: 'equipment',
          title,
          subtitle: eq.customerName || eq.category,
          equipment: eq,
        });
      });
    }

    if (filterMode !== 'equipment') {
      customJobs.forEach((job) => {
        if (q && !job.title.toLowerCase().includes(q)) return;
        cards.push({
          id: job._id,
          type: 'custom',
          title: job.title,
          subtitle: `${job.priority} priority • ${job.estimated_hours}h`,
          customJob: job,
        });
      });
    }

    return cards;
  },

  // ─── Derived: Conflicts ───
  getConflicts: () => {
    const { assignments } = get();
    const techConflicts = new Set<string>();
    const bayConflicts = new Set<string>();

    // Exclude dayoff from conflict checks
    const nonDayOff = assignments.filter((a) => a.source_type !== 'dayoff');

    for (let i = 0; i < nonDayOff.length; i++) {
      for (let j = i + 1; j < nonDayOff.length; j++) {
        const a = nonDayOff[i];
        const b = nonDayOff[j];
        const overlap = rangesOverlap(a.start_date, a.end_date, b.start_date, b.end_date);
        if (!overlap) continue;

        if (techId(a) === techId(b)) {
          techConflicts.add(a._id);
          techConflicts.add(b._id);
        }
        if (a.bay === b.bay) {
          bayConflicts.add(a._id);
          bayConflicts.add(b._id);
        }
      }
    }

    return { techConflicts, bayConflicts };
  },

  // ─── Derived: Summary ───
  getSummary: () => {
    const { assignments, technicians, timelineRange, timelineStartDate } = get();
    const rangeEnd = format(addDays(timelineStartDate, timelineRange), 'yyyy-MM-dd');
    const rangeStart = format(timelineStartDate, 'yyyy-MM-dd');

    const visible = assignments.filter((a) =>
      rangesOverlap(a.start_date, a.end_date, rangeStart, rangeEnd)
    );

    const baysInUse = new Set(visible.filter((a) => a.source_type !== 'dayoff' && a.bay).map((a) => a.bay)).size;

    // Technician loading: % of days used in the visible range
    const loadMap = new Map<string, number>();
    technicians.forEach((t) => loadMap.set(t._id, 0));
    visible.forEach((a) => {
      const tid = techId(a);
      const days = differenceInCalendarDays(parseISO(a.end_date), parseISO(a.start_date)) + 1;
      loadMap.set(tid, (loadMap.get(tid) || 0) + days);
    });
    const threshold = timelineRange * 0.8;
    let overloadedTechs = 0;
    for (const days of loadMap.values()) {
      if (days >= threshold) overloadedTechs++;
    }

    return { scheduled: visible.length, baysInUse, totalBays: 7, overloadedTechs };
  },
}));
