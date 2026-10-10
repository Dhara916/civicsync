import type { Profile, Project } from '../contracts/database.js';
export function isStaff(profile: Profile | null): boolean {
  return !!profile && profile.approval_status === 'approved' && (profile.role === 'admin' || (profile.role === 'official' && !!profile.department_id));
}
export function canManageProject(profile: Profile | null, project: Pick<Project, 'department_id'>): boolean {
  return isStaff(profile) && (profile?.role === 'admin' || profile?.department_id === project.department_id);
}
export function canReviewConflict(profile: Profile | null, a: Project, b: Project): boolean {
  return canManageProject(profile, a) || canManageProject(profile, b);
}
