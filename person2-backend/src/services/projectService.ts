import { supabase } from '../lib/supabase';
import type { DashboardStats, Department, ProjectInsert, ProjectRow, ProjectStatus, WorkType } from '../types/database';
export interface ProjectFilters { search?: string; roadName?: string; departmentId?: string; status?: ProjectStatus | ProjectStatus[]; workType?: WorkType; fromDate?: string; toDate?: string; limit?: number }

export async function getDepartments(): Promise<Department[]> {
  const { data, error } = await supabase.from('departments').select('*').order('name');
  if (error) throw error; return data ?? [];
}

export async function getProjects(filters: ProjectFilters = {}): Promise<ProjectRow[]> {
  let q = supabase.from('projects').select('*, department:departments(id,name)').order('start_date');
  if (filters.search?.trim()) { const term = filters.search.trim().replace(/[,%().*]/g, ' '); q = q.or(`title.ilike.%${term}%,road_name.ilike.%${term}%,location_description.ilike.%${term}%`); }
  if (filters.roadName?.trim()) q = q.ilike('road_name', `%${filters.roadName.trim()}%`);
  if (filters.departmentId) q = q.eq('department_id', filters.departmentId);
  if (filters.status) q = Array.isArray(filters.status) ? q.in('status', filters.status) : q.eq('status', filters.status);
  if (filters.workType) q = q.eq('work_type', filters.workType);
  if (filters.fromDate) q = q.gte('end_date', filters.fromDate);
  if (filters.toDate) q = q.lte('start_date', filters.toDate);
  if (filters.limit) q = q.limit(Math.min(Math.max(filters.limit, 1), 500));
  const { data, error } = await q; if (error) throw error; return (data ?? []) as ProjectRow[];
}
export async function getProject(id: string): Promise<ProjectRow> {
  if (!id) throw new Error('Project ID is required.');
  const { data, error } = await supabase.from('projects').select('*, department:departments(id,name)').eq('id', id).single();
  if (error) throw error; return data as ProjectRow;
}
export async function createProject(input: ProjectInsert): Promise<ProjectRow> {
  validate(input, true);
  const { data, error } = await supabase.from('projects').insert(input).select('*, department:departments(id,name)').single();
  if (error) throw error; return data as ProjectRow;
}
type ProjectDetailsUpdate = Partial<Pick<ProjectInsert, 'title' | 'description' | 'road_name' | 'location_description' | 'latitude' | 'longitude' | 'segment_start_latitude' | 'segment_start_longitude' | 'segment_end_latitude' | 'segment_end_longitude' | 'work_type' | 'department_id' | 'start_date' | 'end_date' | 'contractor_name'>>;
export async function updateProject(id: string, changes: ProjectDetailsUpdate): Promise<ProjectRow> {
  if (!id || !Object.keys(changes).length) throw new Error('Project ID and at least one change are required.');
  if (changes.title && (changes.title.trim().length < 3 || changes.title.length > 160)) throw new Error('Title must be 3 to 160 characters.');
  if (changes.end_date && changes.start_date && changes.end_date < changes.start_date) throw new Error('End date cannot precede start date.');
  const { data, error } = await supabase.from('projects').update(changes).eq('id', id).select('*, department:departments(id,name)').single();
  if (error) throw error; return data as ProjectRow;
}
export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('get_dashboard_stats'); if (error) throw error;
  return data?.[0] ?? { planned_projects: 0, ongoing_projects: 0, overdue_projects: 0, open_reports: 0, open_conflicts: 0 };
}
function validate(p: ProjectInsert, required: boolean) {
  if (required && (!p.title?.trim() || !p.road_name?.trim() || !p.department_id || !p.start_date || !p.end_date)) throw new Error('Title, road, department and dates are required.');
  if (p.end_date && p.start_date && p.end_date < p.start_date) throw new Error('End date cannot precede start date.');
  if (p.progress_percent !== undefined && (p.progress_percent < 0 || p.progress_percent > 100)) throw new Error('Progress must be 0 to 100.');
}
