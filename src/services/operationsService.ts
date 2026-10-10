import { requireSupabase } from '../lib/supabase';
import { AppError, throwIfError } from '../lib/errors';
import { assertUUID } from '../lib/validation';
import type { Profile, CitizenReport, ReportStatus } from '../contracts/database';
import { decodeProfile, decodeReport } from '../integrations/decoders';

export interface OfficialApplicant extends Pick<Profile, 'id' | 'name' | 'department_id' | 'approval_status'> {
  created_at: string;
}
export interface ManagedReport extends CitizenReport {
  official_response: string | null;
  project: {id: string; title: string; road_name: string; department_id: string};
}

export async function getPendingOfficialRequests(): Promise<OfficialApplicant[]> {
  const {data, error} = await requireSupabase().from('profiles')
    .select('id,full_name,role,department_id,approval_status,created_at')
    .eq('role', 'official').eq('approval_status', 'pending').order('created_at', {ascending: true});
  throwIfError(error);
  return (data ?? []).map((row: unknown) => {
    const profile = decodeProfile(row);
    const createdAt = (row as {created_at?: unknown}).created_at;
    if (typeof createdAt !== 'string') throw new AppError('An official request has no creation timestamp.');
    return {...profile, created_at: createdAt};
  });
}

export async function approveOfficialRequest(userId: string, departmentId: string, approval: 'approved' | 'rejected'): Promise<void> {
  assertUUID(userId, 'Official account');
  assertUUID(departmentId, 'Department');
  const {error} = await requireSupabase().rpc('approve_official', {
    p_user_id: userId, p_department_id: departmentId, p_approval: approval,
  });
  throwIfError(error);
}

export async function requestOfficialAccess(departmentId: string): Promise<void> {
  assertUUID(departmentId, 'Department');
  const {error} = await requireSupabase().rpc('request_official_access', {p_department_id: departmentId});
  throwIfError(error);
}

export async function getManageableReports(departmentId?: string | null): Promise<ManagedReport[]> {
  let query = requireSupabase().from('citizen_reports')
    .select('id,user_id,project_id,category,description,status,official_response,created_at,project:projects!inner(id,title,road_name,department_id)')
    .in('status', ['open', 'under_review']).order('created_at', {ascending: true});
  if (departmentId) query = query.eq('project.department_id', departmentId);
  const {data, error} = await query;
  throwIfError(error);
  return (data ?? []).map((value: unknown) => {
    const report = decodeReport(value);
    const raw = value as {official_response?: unknown; project?: unknown};
    const related = Array.isArray(raw.project) ? raw.project[0] : raw.project;
    if (!related || typeof related !== 'object') throw new AppError('A report is missing its related project.');
    const projectRow = related as Record<string, unknown>;
    if (typeof projectRow.id !== 'string' || typeof projectRow.title !== 'string' || typeof projectRow.road_name !== 'string' || typeof projectRow.department_id !== 'string') {
      throw new AppError('A report has an invalid project reference.');
    }
    if (raw.official_response != null && typeof raw.official_response !== 'string') throw new AppError('A report response has an invalid format.');
    return {...report, official_response: raw.official_response ?? null, project: {id: projectRow.id, title: projectRow.title, road_name: projectRow.road_name, department_id: projectRow.department_id}};
  });
}

export async function reviewCitizenReport(id: string, status: Extract<ReportStatus, 'acknowledged' | 'resolved' | 'rejected'>, response: string): Promise<void> {
  assertUUID(id, 'Report');
  const databaseStatus = status === 'acknowledged' ? 'under_review' : status === 'rejected' ? 'dismissed' : 'resolved';
  const note = response.trim();
  if (note.length > 2000) throw new AppError('The official response must be 2,000 characters or fewer.');
  const {error} = await requireSupabase().rpc('review_citizen_report', {
    p_report_id: id, p_status: databaseStatus, p_response: note || null,
  });
  throwIfError(error);
}
