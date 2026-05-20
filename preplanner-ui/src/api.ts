import axios from 'axios';
import type {
  PlannerBootstrap,
  Assignment,
  AssignmentFormData,
  CustomJob,
  Holiday,
} from './types';

const api = axios.create({ baseURL: '/api/planner' });

export async function fetchPlannerData(from?: string, to?: string): Promise<PlannerBootstrap> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const { data } = await api.get<PlannerBootstrap>('/', { params });
  return data;
}

export async function createAssignment(payload: AssignmentFormData): Promise<Assignment> {
  const { data } = await api.post<Assignment>('/assignments', payload);
  return data;
}

export async function updateAssignment(id: string, payload: Partial<AssignmentFormData>): Promise<Assignment> {
  const { data } = await api.put<Assignment>(`/assignments/${id}`, payload);
  return data;
}

export async function deleteAssignment(id: string): Promise<void> {
  await api.delete(`/assignments/${id}`);
}

export async function bulkSaveAssignments(assignments: Partial<Assignment>[]): Promise<{ saved: number }> {
  const { data } = await api.post('/assignments/bulk', assignments);
  return data;
}

export async function createCustomJob(payload: Omit<CustomJob, '_id' | 'assigned' | 'createdAt'>): Promise<CustomJob> {
  const { data } = await api.post<CustomJob>('/custom-jobs', payload);
  return data;
}

export async function deleteCustomJob(id: string): Promise<void> {
  await api.delete(`/custom-jobs/${id}`);
}

// ─── Holidays ──────────────────────────────────────────────

export async function fetchHolidays(): Promise<Holiday[]> {
  const { data } = await api.get<Holiday[]>('/holidays');
  return data;
}

export async function createHoliday(payload: { name: string; date: string }): Promise<Holiday> {
  const { data } = await api.post<Holiday>('/holidays', payload);
  return data;
}

export async function deleteHoliday(id: string): Promise<void> {
  await api.delete(`/holidays/${id}`);
}
