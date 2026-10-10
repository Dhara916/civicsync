import { requireSupabase } from '../lib/supabase';
import { AppError, throwIfError } from '../lib/errors';
import { assertText, assertUUID } from '../lib/validation';
import { decodeConflict, decodeConflictEvent, singleRpc } from '../integrations/decoders';
import type { Page } from '../contracts/database';
import type { ConflictDecision, ConflictEvent, ConflictStatus, ProjectConflict } from '../types/conflict';
export async function getConflicts(options: {status?: ConflictStatus | ''; projectId?: string; page?: number; pageSize?: number} = {}): Promise<Page<ProjectConflict>> {
  const page = Math.max(1, options.page ?? 1), pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  let q = requireSupabase().from('project_conflicts').select('*', {count: 'exact'});
  if (options.status) q = q.eq('status', options.status);
  if (options.projectId) { assertUUID(options.projectId); q = q.or(`project_a_id.eq.${options.projectId},project_b_id.eq.${options.projectId}`); }
  const {data, error, count} = await q.order('updated_at', {ascending: false}).order('id').range((page - 1) * pageSize, page * pageSize - 1);
  throwIfError(error); if (count == null) throw new AppError('Conflict count unavailable.');
  return {items: (data ?? []).map(decodeConflict), total: count, page, pageSize};
}
export async function checkProjectConflicts(projectId: string): Promise<void> {
  assertUUID(projectId);
  const {error} = await requireSupabase().rpc('check_project_conflicts', {p_project_id: projectId});
  throwIfError(error);
}
export async function resolveConflict(conflictId: string, decision: ConflictDecision): Promise<ProjectConflict> {
  assertUUID(conflictId); assertUUID(decision.request_id); assertText(decision.note, 'Decision note', 20, 2000);
  if (!['resolved', 'dismissed'].includes(decision.status)) throw new AppError('Choose a valid conflict decision.');
  if (!Number.isInteger(decision.expected_version) || decision.expected_version < 1) throw new AppError('Reload the conflict before reviewing it.');
  const {data, error} = await requireSupabase().rpc('resolve_conflict', {
    p_conflict_id: conflictId, p_decision: decision.status, p_note: decision.note.trim(),
    p_expected_version: decision.expected_version, p_request_id: decision.request_id,
  });
  throwIfError(error); return decodeConflict(singleRpc(data));
}
export async function getConflictEvents(conflictId: string, page = 1): Promise<Page<ConflictEvent>> {
  assertUUID(conflictId);
  const pageSize = 20;
  const {data, error, count} = await requireSupabase().from('conflict_events').select('*', {count: 'exact'}).eq('conflict_id', conflictId).order('created_at', {ascending: false}).order('id').range((page - 1) * pageSize, page * pageSize - 1);
  throwIfError(error); if (count == null) throw new AppError('Conflict history count unavailable.');
  return {items: (data ?? []).map(decodeConflictEvent), total: count, page, pageSize};
}
