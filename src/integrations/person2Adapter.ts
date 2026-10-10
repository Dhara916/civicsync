/** Maps Person 1/3 service calls onto Person 2's existing Supabase schema.
 * All calls share the one browser client; this module does not create tables.
 */
import { requireSupabase } from '../lib/supabase';
import { AppError, throwIfError } from '../lib/errors';
import { assertUUID, safeSearch, validateProject, validateReport, validateUpdate } from '../lib/validation';
import type { Page, Project, ProjectDraft, ProjectFilters, Department, Profile, CitizenReport, ReportDraft, ProjectUpdate, UpdateDraft, DashboardStats, SessionUser } from '../contracts/database';
import { decodeProject, decodeDepartment, decodeProfile, decodeReport, decodeUpdate, singleRpc } from './decoders';
import { toDatabaseProjectStatus, toDatabaseWorkType, databaseWorkTypeFilter, toDatabaseReportCategory } from './person2Contract';
const paging = (page = 1, pageSize = 20) => ({page: Math.max(1, Math.floor(page)), pageSize: Math.max(1, Math.min(200, Math.floor(pageSize)))});
export async function getProjects(filters: ProjectFilters = {}): Promise<Page<Project>> {
  const {page, pageSize} = paging(filters.page, filters.pageSize);
  let q = requireSupabase().from('projects').select('*', {count: 'exact'});
  const search = safeSearch(filters.search ?? '');
  if (search) q = q.or(`title.ilike.%${search}%,road_name.ilike.%${search}%`);
  if (filters.status) q = q.eq('status', toDatabaseProjectStatus(filters.status));
  if (filters.department_id) { assertUUID(filters.department_id); q = q.eq('department_id', filters.department_id); }
  if (filters.work_type) q = q.in('work_type', databaseWorkTypeFilter(filters.work_type));
  const {data, error, count} = await q.order('start_date', {ascending: false}).order('id').range((page - 1) * pageSize, page * pageSize - 1);
  throwIfError(error);
  if (count == null) throw new AppError('The backend did not return the project count.');
  return {items: (data ?? []).map(decodeProject), total: count, page, pageSize};
}
export async function getProject(id: string): Promise<Project | null> {
  assertUUID(id, 'Project');
  const {data, error} = await requireSupabase().from('projects').select('*').eq('id', id).maybeSingle();
  throwIfError(error); return data ? decodeProject(data) : null;
}
export async function getProjectsByIds(ids: string[]): Promise<Project[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  if (unique.length > 200) throw new AppError('Load at most 200 related projects per request.');
  unique.forEach(id => assertUUID(id));
  const {data, error} = await requireSupabase().from('projects').select('*').in('id', unique);
  throwIfError(error); return (data ?? []).map(decodeProject);
}
export async function getDepartments(): Promise<Department[]> {
  const {data, error, count} = await requireSupabase().from('departments').select('*', {count: 'exact'}).order('name').range(0, 999);
  throwIfError(error);
  if (count != null && count > 1000) throw new AppError('More than 1,000 departments exist. Add paginated department lookup to the adapter before using this selector.');
  return (data ?? []).map(decodeDepartment);
}
export async function createProject(draft: ProjectDraft): Promise<Project> {
  validateProject(draft);
  const {location, ...fields} = draft;
  const payload = {...fields, location_description: location.trim(), work_type: toDatabaseWorkType(draft.work_type), status: toDatabaseProjectStatus(draft.status), title: draft.title.trim(), road_name: draft.road_name.trim()};
  const {data, error} = await requireSupabase().from('projects').insert(payload).select('*').single();
  if (error?.code === '23505') {
    const existing = await getProject(draft.id);
    // A timed-out insert may have committed. Accept only the same saved request.
    if (existing && existing.title === payload.title && existing.road_name === payload.road_name && existing.location === location.trim() && existing.work_type === draft.work_type && existing.department_id === draft.department_id && existing.start_date === draft.start_date && existing.end_date === draft.end_date && existing.status === draft.status) return existing;
  }
  throwIfError(error); return decodeProject(data);
}
export async function updateProject(draft: ProjectDraft, expectedVersion: number): Promise<Project> {
  validateProject(draft);
  const {id, ...changes} = draft;
  const p_changes = {...changes, location_description: changes.location, work_type: toDatabaseWorkType(changes.work_type), status: toDatabaseProjectStatus(changes.status)};
  delete (p_changes as Partial<typeof p_changes>).location;
  const {data, error} = await requireSupabase().rpc('save_project_changes', {p_project_id: id, p_expected_version: expectedVersion, p_changes});
  throwIfError(error); return decodeProject(singleRpc(data));
}
async function exactCount(table: string, filter?: {field: string; values: string[]}): Promise<number> {
  let q = requireSupabase().from(table).select('id', {count: 'exact', head: true});
  if (filter) q = q.in(filter.field, filter.values);
  const {count, error} = await q; throwIfError(error);
  if (count == null) throw new AppError(`The backend did not return the ${table} count.`);
  return count;
}
export async function getDashboardStats(): Promise<DashboardStats> {
  const [totalProjects, activeProjects, completedProjects, openConflicts] = await Promise.all([
    exactCount('projects'), exactCount('projects', {field: 'status', values: ['planned', 'ongoing', 'delayed']}),
    exactCount('projects', {field: 'status', values: ['completed']}),
    exactCount('project_conflicts', {field: 'status', values: ['open', 'coordinating']}),
  ]);
  return {totalProjects, activeProjects, completedProjects, openConflicts};
}
export async function getCurrentUser(): Promise<SessionUser | null> {
  const {data, error} = await requireSupabase().auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throwIfError(error);
  return data.user ? {id: data.user.id, email: data.user.email ?? null} : null;
}
export async function getProfile(id: string): Promise<Profile | null> {
  assertUUID(id);
  const {data, error} = await requireSupabase().from('profiles').select('id,full_name,role,department_id,approval_status').eq('id', id).maybeSingle();
  throwIfError(error); return data ? decodeProfile(data) : null;
}
export async function signIn(email: string, password: string): Promise<void> {
  const {error} = await requireSupabase().auth.signInWithPassword({email: email.trim(), password}); throwIfError(error);
}
export async function signUp(name: string, email: string, password: string): Promise<boolean> {
  const {data, error} = await requireSupabase().auth.signUp({email: email.trim(), password, options: {data: {full_name: name.trim()}, emailRedirectTo: `${window.location.origin}/auth/callback`}});
  throwIfError(error); return !!data.session;
}
export async function signOut(): Promise<void> { const {error} = await requireSupabase().auth.signOut(); throwIfError(error); }
export async function resetPassword(email: string): Promise<void> {
  const {error} = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {redirectTo: `${window.location.origin}/reset-password`}); throwIfError(error);
}
export async function changePassword(password: string): Promise<void> { const {error} = await requireSupabase().auth.updateUser({password}); throwIfError(error); }
export async function submitReport(draft: ReportDraft): Promise<CitizenReport> {
  validateReport(draft);
  const user = await getCurrentUser(); if (!user) throw new AppError('Sign in before submitting a report.');
  const payload = {...draft, category: toDatabaseReportCategory(draft.category), user_id: user.id, description: draft.description.trim(), status: 'open'};
  const {data, error} = await requireSupabase().from('citizen_reports').insert(payload).select('*').single();
  if (error?.code === '23505') {
    const result = await requireSupabase().from('citizen_reports').select('*').eq('id', draft.id).eq('user_id', user.id).maybeSingle();
    if (!result.error && result.data) {
      const existing = decodeReport(result.data);
      if (existing.project_id === payload.project_id && existing.category === payload.category && existing.description === payload.description) return existing;
    }
  }
  throwIfError(error); return decodeReport(data);
}
export async function getMyReports(page = 1): Promise<Page<CitizenReport>> {
  const user = await getCurrentUser(); if (!user) throw new AppError('Sign in to see your reports.');
  const p = paging(page, 20);
  const {data, error, count} = await requireSupabase().from('citizen_reports').select('*', {count: 'exact'}).eq('user_id', user.id).order('created_at', {ascending: false}).order('id').range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  throwIfError(error); if (count == null) throw new AppError('Report count unavailable.');
  return {items: (data ?? []).map(decodeReport), total: count, ...p};
}
export async function getProjectUpdates(projectId: string, page = 1): Promise<Page<ProjectUpdate>> {
  assertUUID(projectId);
  const p = paging(page, 30);
  const {data, error, count} = await requireSupabase().from('project_updates').select('*', {count: 'exact'}).eq('project_id', projectId).order('created_at', {ascending: false}).order('id').range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  throwIfError(error); if (count == null) throw new AppError('Update count unavailable.');
  return {items: (data ?? []).map(decodeUpdate), total: count, ...p};
}
export async function publishProjectUpdate(draft: UpdateDraft): Promise<ProjectUpdate> {
  validateUpdate(draft);
  const {data, error} = await requireSupabase().rpc('publish_project_update', {
    p_request_id: draft.id, p_project_id: draft.project_id, p_expected_version: draft.expected_version,
    p_status: toDatabaseProjectStatus(draft.status), p_progress_percent: draft.progress_percent,
    p_progress_note: draft.progress_note.trim(), p_delay_reason: draft.delay_reason?.trim() || null, p_revised_end_date: draft.revised_end_date,
  });
  throwIfError(error); return decodeUpdate(singleRpc(data));
}
