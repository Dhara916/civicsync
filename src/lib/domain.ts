import type { ProjectStatus, WorkType } from '../contracts/database.js';
export const WORK_LABELS: Record<WorkType, string> = {
  water: 'Water supply', sewer: 'Sewerage', drainage: 'Stormwater drainage',
  electricity: 'Electricity', telecom: 'Telecommunications',
  road_resurfacing: 'Road resurfacing', excavation: 'Excavation', inspection: 'Non-intrusive inspection',
  sewer_drainage: 'Sewer and drainage (existing record)', other: 'Other work',
};
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Planned', in_progress: 'In progress', delayed: 'Delayed', completed: 'Completed', cancelled: 'Cancelled',
};
export const CONFLICT_DISTANCE_METRES = 30;
export const ACTIVE_STATUSES: ProjectStatus[] = ['planned', 'in_progress', 'delayed'];
export function normalizeSegmentId(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  if (![aStart, aEnd, bStart, bEnd].every(isISODate) || aStart > aEnd || bStart > bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}
export function overlapWindow(aStart: string, aEnd: string, bStart: string, bEnd: string): {start: string; end: string} | null {
  return datesOverlap(aStart, aEnd, bStart, bEnd) ? {start: aStart > bStart ? aStart : bStart, end: aEnd < bEnd ? aEnd : bEnd} : null;
}
export function workTypesConflict(a: WorkType, b: WorkType): boolean {
  // Explicit policy: every listed work type except NON-INTRUSIVE inspection needs coordination.
  return a !== 'inspection' && b !== 'inspection';
}
export function canonicalPair(a: string, b: string): [string, string] {
  const left = a.toLowerCase(), right = b.toLowerCase();
  if (left === right) throw new Error('A project cannot conflict with itself.');
  return left < right ? [left, right] : [right, left];
}
export function transitionAllowed(from: ProjectStatus, to: ProjectStatus): boolean {
  if (from === to) return true;
  const allowed: Record<ProjectStatus, ProjectStatus[]> = {
    planned: ['in_progress', 'delayed', 'cancelled'],
    in_progress: ['delayed', 'completed', 'cancelled'],
    delayed: ['planned', 'in_progress', 'completed', 'cancelled'],
    completed: [], cancelled: [],
  };
  return allowed[from].includes(to);
}
