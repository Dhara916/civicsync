import { type Project, type Department, type Profile, type ProjectUpdate, type CitizenReport } from '../contracts/database';
import type { ProjectConflict, ConflictEvent } from '../types/conflict';
import { AppError } from '../lib/errors';
import { parseGeometry } from '../lib/validation';
import { fromDatabaseProjectStatus, fromDatabaseWorkType, fromDatabaseReportCategory, fromDatabaseReportStatus } from './person2Contract';
type Row = Record<string, unknown>;
function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('The backend returned an invalid record.', 'CONTRACT_MISMATCH');
  return value as Row;
}
function text(r: Row, key: string): string {
  if (typeof r[key] !== 'string') throw new AppError(`Backend field “${key}” must be a string. Check the integration contract.`, 'CONTRACT_MISMATCH');
  return r[key] as string;
}
function optionalText(r: Row, key: string): string | null { return r[key] == null ? null : text(r, key); }
function number(r: Row, key: string): number {
  if (typeof r[key] !== 'number' || !Number.isFinite(r[key])) throw new AppError(`Backend field “${key}” must be a finite number.`, 'CONTRACT_MISMATCH');
  return r[key] as number;
}
function choice<T extends string>(r: Row, key: string, values: readonly T[]): T {
  const value = text(r, key);
  if (!values.includes(value as T)) throw new AppError(`Unmapped backend ${key}: “${value}”. Update the Person 2 adapter instead of silently replacing it.`, 'CONTRACT_MISMATCH');
  return value as T;
}
export function decodeProject(value: unknown): Project {
  const r = row(value);
  return { id: text(r, 'id'), title: text(r, 'title'), road_name: text(r, 'road_name'), location: optionalText(r, 'location_description'),
    work_type: fromDatabaseWorkType(r.work_type), department_id: text(r, 'department_id'),
    start_date: text(r, 'start_date'), end_date: text(r, 'end_date'), status: fromDatabaseProjectStatus(r.status),
    latitude: r.latitude == null ? null : number(r, 'latitude'), longitude: r.longitude == null ? null : number(r, 'longitude'),
    road_segment_id: optionalText(r, 'road_segment_id'), work_geometry: r.work_geometry == null ? null : parseGeometry(r.work_geometry), version: number(r, 'version'),
    progress_percent: number(r, 'progress_percent'),
  };
}
export function decodeDepartment(value: unknown): Department { const r = row(value); return {id: text(r, 'id'), name: text(r, 'name'), contact: optionalText(r, 'contact_email') ?? optionalText(r, 'contact_phone')}; }
export function decodeProfile(value: unknown): Profile { const r = row(value); return {id: text(r, 'id'), name: optionalText(r, 'full_name'), role: choice(r, 'role', ['citizen', 'official', 'admin']), department_id: optionalText(r, 'department_id'), approval_status: choice(r, 'approval_status', ['pending', 'approved', 'rejected'])}; }
export function decodeReport(value: unknown): CitizenReport { const r = row(value); return {id: text(r, 'id'), user_id: text(r, 'user_id'), project_id: text(r, 'project_id'), category: fromDatabaseReportCategory(r.category), description: text(r, 'description'), status: fromDatabaseReportStatus(r.status), created_at: text(r, 'created_at')}; }
export function decodeUpdate(value: unknown): ProjectUpdate { const r = row(value); return {id: text(r, 'id'), project_id: text(r, 'project_id'), status: fromDatabaseProjectStatus(r.status), progress_note: text(r, 'progress_note'), delay_reason: optionalText(r, 'delay_reason'), revised_end_date: optionalText(r, 'revised_end_date'), updated_by: optionalText(r, 'updated_by'), created_at: text(r, 'created_at'), progress_percent: number(r, 'progress_percent')}; }
export function decodeConflict(value: unknown): ProjectConflict {
  const r = row(value);
  if (typeof r.is_current !== 'boolean') throw new AppError('Backend conflict is_current must be a boolean.', 'CONTRACT_MISMATCH');
  return {id: text(r, 'id'), project_a_id: text(r, 'project_a_id'), project_b_id: text(r, 'project_b_id'), reason: text(r, 'reason'), status: choice(r, 'status', ['open', 'coordinating', 'resolved', 'dismissed', 'cleared']), resolution_note: optionalText(r, 'resolution_note'), reviewed_by: optionalText(r, 'reviewed_by'), reviewed_at: optionalText(r, 'reviewed_at'), detected_at: text(r, 'detected_at'), updated_at: text(r, 'updated_at'), version: number(r, 'version'), fingerprint: text(r, 'fingerprint'), is_current: r.is_current, overlap_start: text(r, 'overlap_start'), overlap_end: text(r, 'overlap_end'), spatial_reason: text(r, 'spatial_reason'), distance_m: r.distance_m == null ? null : number(r, 'distance_m')};
}
export function decodeConflictEvent(value: unknown): ConflictEvent { const r = row(value); return {id: text(r, 'id'), conflict_id: text(r, 'conflict_id'), event_type: choice(r, 'event_type', ['detected', 'reopened', 'cleared', 'resolved', 'dismissed']), note: text(r, 'note'), actor_id: optionalText(r, 'actor_id'), created_at: text(r, 'created_at')}; }
export function singleRpc(value: unknown): unknown {
  if (Array.isArray(value)) { if (value.length !== 1) throw new AppError('The backend did not return exactly one saved record.'); return value[0]; }
  if (value == null) throw new AppError('The backend returned no saved record.');
  return value;
}
