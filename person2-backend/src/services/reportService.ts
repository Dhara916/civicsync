import { supabase } from '../lib/supabase';
import type { CitizenReportRow, ReportCategory, ReportStatus } from '../types/database';
export interface SubmitReportInput { projectId: string; category: ReportCategory; description: string; photoPath?: string | null }

/** Upload an optional report image to the private bucket before calling submitReport. */
export async function uploadReportPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG, or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Photo must be 5 MB or smaller.');
  const { data: { user }, error: authError } = await supabase.auth.getUser(); if (authError) throw authError;
  if (!user) throw new Error('Sign in before uploading a report photo.');
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `reports/${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('civic-report-photos').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error; return path;
}
export async function getReportPhotoUrl(path: string, expiresInSeconds = 300): Promise<string> {
  if (!path.startsWith('reports/')) throw new Error('Invalid photo path.');
  const { data, error } = await supabase.storage.from('civic-report-photos').createSignedUrl(path, Math.min(Math.max(expiresInSeconds, 60), 3600));
  if (error) throw error; return data.signedUrl;
}

export async function submitReport(input: SubmitReportInput): Promise<CitizenReportRow> {
  const description = input.description.trim();
  if (!input.projectId || description.length < 10 || description.length > 4000) throw new Error('Choose a project and enter a 10 to 4,000 character report.');
  if (input.photoPath && (!input.photoPath.startsWith('reports/') || input.photoPath.length > 500)) throw new Error('Invalid photo path.');
  const { data: { user }, error: authError } = await supabase.auth.getUser(); if (authError) throw authError;
  if (!user) throw new Error('Sign in to submit a report.');
  const { data, error } = await supabase.from('citizen_reports').insert({ user_id: user.id, project_id: input.projectId, category: input.category, description, photo_path: input.photoPath ?? null }).select('*, project:projects(id,title,road_name,department_id)').single();
  if (error) throw error; return data as CitizenReportRow;
}
export async function getMyReports(): Promise<CitizenReportRow[]> {
  const { data, error } = await supabase.from('citizen_reports').select('*, project:projects(id,title,road_name,department_id)').order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as CitizenReportRow[];
}
export async function getReportsForDepartment(departmentId: string): Promise<CitizenReportRow[]> {
  if (!departmentId) throw new Error('Department ID is required.');
  const { data, error } = await supabase.from('citizen_reports').select('*, project:projects!inner(id,title,road_name,department_id)').eq('project.department_id', departmentId).order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as CitizenReportRow[];
}
export async function reviewReport(id: string, status: Extract<ReportStatus, 'under_review' | 'resolved' | 'dismissed'>, response?: string): Promise<void> {
  if (!id || (response && response.trim().length > 2000)) throw new Error('Invalid report ID or response length.');
  const { error } = await supabase.rpc('review_citizen_report', { p_report_id: id, p_status: status, p_response: response?.trim() || null });
  if (error) throw error;
}
