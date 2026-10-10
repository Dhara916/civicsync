import { supabase } from '../lib/supabase';
import type { ProjectStatus, ProjectUpdateRow } from '../types/database';
export interface CreateProjectUpdateInput { projectId: string; status: ProjectStatus; progressPercent: number; progressNote: string; delayReason?: string | null; revisedEndDate?: string | null }

export async function getProjectUpdates(projectId: string): Promise<ProjectUpdateRow[]> {
  if (!projectId) throw new Error('Project ID is required.');
  const { data, error } = await supabase.from('project_updates').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) throw error; return data ?? [];
}
export async function addProjectUpdate(input: CreateProjectUpdateInput): Promise<ProjectUpdateRow> {
  const note = input.progressNote.trim();
  if (!input.projectId || note.length < 3 || note.length > 2000) throw new Error('Project and a 3 to 2,000 character note are required.');
  if (!Number.isInteger(input.progressPercent) || input.progressPercent < 0 || input.progressPercent > 100) throw new Error('Progress must be an integer from 0 to 100.');
  if (input.status === 'delayed' && !input.delayReason?.trim()) throw new Error('A delay reason is required.');
  if (input.delayReason && input.delayReason.trim().length > 1000) throw new Error('Delay reason is limited to 1,000 characters.');
  const { data, error } = await supabase.from('project_updates').insert({ project_id: input.projectId, status: input.status, progress_percent: input.progressPercent, progress_note: note, delay_reason: input.delayReason?.trim() || null, revised_end_date: input.revisedEndDate || null }).select().single();
  if (error) throw error; return data;
}
