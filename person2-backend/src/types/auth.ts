import type { ApprovalStatus, UserRole } from './database';
export type { ApprovalStatus, UserRole } from './database';
export interface ProfileRow {
  id: string; full_name: string | null; role: UserRole; department_id: string | null;
  approval_status: ApprovalStatus; created_at: string; updated_at: string;
}
