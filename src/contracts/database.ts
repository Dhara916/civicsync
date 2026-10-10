/** Proposed Person 1/3 integration contract. Person 2 remains the schema owner.
 * Map different backend names once in integrations/person2Adapter.ts; never in components.
 */
export const PROJECT_STATUSES = ['planned', 'in_progress', 'delayed', 'completed', 'cancelled'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];
export const WORK_TYPES = ['water', 'sewer', 'drainage', 'electricity', 'telecom', 'road_resurfacing', 'excavation', 'inspection', 'sewer_drainage', 'other'] as const;
export type WorkType = typeof WORK_TYPES[number];
export const REPORT_CATEGORIES = ['safety_hazard', 'road_damage', 'water_leak', 'access_blocked', 'noise', 'other', 'quality', 'safety', 'delay', 'damage'] as const;
export type ReportCategory = typeof REPORT_CATEGORIES[number];
export type ReportStatus = 'submitted' | 'acknowledged' | 'in_progress' | 'resolved' | 'rejected';
export type Role = 'citizen' | 'official' | 'admin';
export interface Profile { id: string; name: string | null; role: Role; department_id: string | null; approval_status: 'pending' | 'approved' | 'rejected' }
export interface Department { id: string; name: string; contact: string | null }
export type Position = [number, number]; // GeoJSON order: [longitude, latitude].
export type WorkGeometry = {type: 'Point'; coordinates: Position} | {type: 'LineString'; coordinates: Position[]};
export interface Project {
  id: string; title: string; road_name: string; location: string | null;
  work_type: WorkType; department_id: string; start_date: string; end_date: string;
  status: ProjectStatus; latitude: number | null; longitude: number | null;
  road_segment_id: string | null; work_geometry: WorkGeometry | null;
  version: number; progress_percent: number;
}
export interface ProjectDraft {
  id: string; title: string; road_name: string; location: string;
  work_type: WorkType; department_id: string; start_date: string; end_date: string;
  status: ProjectStatus; latitude: number; longitude: number;
  road_segment_id: string | null; work_geometry: WorkGeometry | null;
}
export interface ProjectFilters { search?: string; status?: ProjectStatus | ''; department_id?: string; work_type?: WorkType | ''; page?: number; pageSize?: number }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface CitizenReport {
  id: string; user_id: string; project_id: string; category: ReportCategory;
  description: string; status: ReportStatus; created_at: string;
}
export interface ReportDraft { id: string; project_id: string; category: ReportCategory; description: string }
export interface ProjectUpdate {
  id: string; project_id: string; status: ProjectStatus; progress_note: string;
  delay_reason: string | null; revised_end_date: string | null;
  updated_by: string | null; created_at: string; progress_percent: number;
}
export interface UpdateDraft {
  id: string; project_id: string; expected_version: number; status: ProjectStatus;
  progress_note: string; progress_percent: number; delay_reason: string | null; revised_end_date: string | null;
}
export interface DashboardStats { totalProjects: number; activeProjects: number; completedProjects: number; openConflicts: number }
export interface SessionUser { id: string; email: string | null }
