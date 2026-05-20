/* ─── Shared TypeScript types for the Pre-Planner ─── */

export interface Technician {
  _id: string;
  name: string;
  stockHours?: number;
}

export interface EquipmentItem {
  _id: string;
  equipmentId: string;
  equipmentName: string;
  customerName: string;
  customerContact?: string;
  category: string;
  issueDescription?: string;
  status: string;
}

export interface CustomJob {
  _id: string;
  title: string;
  description: string;
  estimated_hours: number;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  assigned: boolean;
  createdAt: string;
}

export interface Holiday {
  _id: string;
  name: string;
  date: string; // ISO
  source: 'system' | 'manual';
}

export type SourceType = 'equipment' | 'custom' | 'dayoff';

/** A draggable card in the source panel */
export interface SourceCard {
  id: string; // _id of Equipment or CustomJob
  type: SourceType;
  title: string;
  subtitle: string;
  equipment?: EquipmentItem;
  customJob?: CustomJob;
}

/** An assignment block on the timeline */
export interface Assignment {
  _id: string;
  technician_id: Technician | string;
  source_type: SourceType;
  equipment_id?: EquipmentItem | string | null;
  title: string;
  description: string;
  bay: string;
  start_date: string; // ISO
  end_date: string;   // ISO
  priority: 'low' | 'medium' | 'high';
  is_rush: boolean;
  notes: string;
  tags: string[];
  estimated_hours: number;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Data used when creating/editing an assignment via the modal */
export interface AssignmentFormData {
  technician_id: string;
  title: string;
  description: string;
  bay: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  priority: 'low' | 'medium' | 'high';
  is_rush: boolean;
  notes: string;
  tags: string[];
  estimated_hours: number;
  source_type: SourceType;
  equipment_id?: string | null;
  color: string;
}

/** Bootstrap payload from GET /api/planner */
export interface PlannerBootstrap {
  technicians: Technician[];
  assignments: Assignment[];
  equipment: EquipmentItem[];
  customJobs: CustomJob[];
  holidays: Holiday[];
}

/** Undo history entry */
export interface UndoEntry {
  label: string;
  snapshot: Assignment[];
}

export type TimelineRange = 7 | 14 | 30 | 60;

export type FilterMode = 'all' | 'equipment' | 'custom';
