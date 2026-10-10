export type ConflictStatus = 'open' | 'coordinating' | 'resolved' | 'dismissed' | 'cleared';
export interface ProjectConflict {
  id: string; project_a_id: string; project_b_id: string;
  reason: string; status: ConflictStatus; resolution_note: string | null;
  reviewed_by: string | null; reviewed_at: string | null;
  detected_at: string; updated_at: string; version: number;
  fingerprint: string; is_current: boolean;
  overlap_start: string; overlap_end: string;
  spatial_reason: string; distance_m: number | null;
}
export interface ConflictDecision { request_id: string; status: 'resolved' | 'dismissed'; note: string; expected_version: number }
export interface ConflictEvent {
  id: string; conflict_id: string; event_type: 'detected' | 'reopened' | 'cleared' | 'resolved' | 'dismissed';
  note: string; actor_id: string | null; created_at: string;
}
