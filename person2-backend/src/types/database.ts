export type UserRole = 'citizen' | 'official' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ProjectStatus = 'planned' | 'ongoing' | 'delayed' | 'completed' | 'cancelled';
export type WorkType = 'road_repair' | 'water_pipeline' | 'sewer_drainage' | 'electricity' | 'telecom' | 'other';
export type ReportCategory = 'quality' | 'safety' | 'delay' | 'damage' | 'other';
export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
export type ConflictStatus = 'open' | 'coordinating' | 'resolved' | 'dismissed';
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Department = { id: string; name: string; contact_email: string | null; contact_phone: string | null; created_at: string };
export type Profile = { id: string; full_name: string | null; role: UserRole; department_id: string | null; approval_status: ApprovalStatus; created_at: string; updated_at: string };
export type ProjectRow = {
  id: string; title: string; description: string | null; road_name: string; location_description: string | null;
  latitude: number | null; longitude: number | null; segment_start_latitude: number | null; segment_start_longitude: number | null;
  segment_end_latitude: number | null; segment_end_longitude: number | null; work_type: WorkType; department_id: string;
  start_date: string; end_date: string; actual_end_date: string | null; revised_end_date: string | null;
  status: ProjectStatus; progress_percent: number; contractor_name: string | null; created_by: string | null;
  created_at: string; updated_at: string; department?: Pick<Department, 'id' | 'name'>;
};
export type ProjectInsert = Pick<ProjectRow, 'title' | 'road_name' | 'work_type' | 'department_id' | 'start_date' | 'end_date'> &
  Partial<Pick<ProjectRow, 'description' | 'location_description' | 'latitude' | 'longitude' | 'segment_start_latitude' | 'segment_start_longitude' | 'segment_end_latitude' | 'segment_end_longitude' | 'status' | 'progress_percent' | 'contractor_name' | 'actual_end_date' | 'revised_end_date'>>;
export type CitizenReportRow = {
  id: string; user_id: string; project_id: string; category: ReportCategory; description: string; photo_path: string | null;
  status: ReportStatus; official_response: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string;
  project?: Pick<ProjectRow, 'id' | 'title' | 'road_name' | 'department_id'>;
};
export type ProjectUpdateRow = { id: string; project_id: string; status: ProjectStatus; progress_percent: number; progress_note: string; delay_reason: string | null; revised_end_date: string | null; updated_by: string | null; created_at: string };
export type ProjectConflictRow = { id: string; project_a_id: string; project_b_id: string; reason: string; status: ConflictStatus; resolution_note: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string };
export type DashboardStats = { planned_projects: number; ongoing_projects: number; overdue_projects: number; open_reports: number; open_conflicts: number };

type Relationship = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };
type Table<Row, Insert, Update = Partial<Insert>, Relations extends Relationship[] = []> = { Row: Row; Insert: Insert; Update: Update; Relationships: Relations };
export interface Database {
  public: {
    Tables: {
      departments: Table<Department, { id?: string; name: string; contact_email?: string | null; contact_phone?: string | null }>;
      profiles: Table<Profile, { id: string; full_name?: string | null; role?: UserRole; department_id?: string | null; approval_status?: ApprovalStatus }, { full_name?: string | null }>;
      projects: Table<ProjectRow, ProjectInsert, Partial<ProjectInsert>, [
        { foreignKeyName: 'projects_department_id_fkey'; columns: ['department_id']; isOneToOne: false; referencedRelation: 'departments'; referencedColumns: ['id'] }
      ]>;
      citizen_reports: Table<CitizenReportRow, { user_id: string; project_id: string; category: ReportCategory; description: string; photo_path?: string | null }, {}, [
        { foreignKeyName: 'citizen_reports_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] }
      ]>;
      project_updates: Table<ProjectUpdateRow, { project_id: string; status: ProjectStatus; progress_percent: number; progress_note: string; delay_reason?: string | null; revised_end_date?: string | null }, {}, [
        { foreignKeyName: 'project_updates_project_id_fkey'; columns: ['project_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] }
      ]>;
      project_conflicts: Table<ProjectConflictRow, { project_a_id: string; project_b_id: string; reason: string }, {}, [
        { foreignKeyName: 'project_conflicts_project_a_id_fkey'; columns: ['project_a_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] },
        { foreignKeyName: 'project_conflicts_project_b_id_fkey'; columns: ['project_b_id']; isOneToOne: false; referencedRelation: 'projects'; referencedColumns: ['id'] }
      ]>;
      project_audit_log: Table<{ id: string; project_id: string; actor_id: string | null; action: string; old_values: Json | null; new_values: Json | null; created_at: string }, {}, {}>;
    };
    Views: Record<string, never>;
    Functions: {
      get_dashboard_stats: { Args: Record<string, never>; Returns: DashboardStats[] };
      review_citizen_report: { Args: { p_report_id: string; p_status: ReportStatus; p_response?: string | null }; Returns: undefined };
      approve_official: { Args: { p_user_id: string; p_department_id: string; p_approval: ApprovalStatus }; Returns: undefined };
      request_official_access: { Args: { p_department_id: string }; Returns: undefined };
      resolve_project_conflict: { Args: { p_conflict_id: string; p_status: ConflictStatus; p_resolution_note: string }; Returns: undefined };
    };
    Enums: Record<string, never>; CompositeTypes: Record<string, never>;
  };
}
