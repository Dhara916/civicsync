import { supabase } from '../lib/supabase';
import type { ApprovalStatus, ProfileRow, UserRole } from '../types/auth';
export async function signUpWithEmail(email: string, password: string, fullName: string) {
  const name = fullName.trim(); if (name.length < 2 || name.length > 120) throw new Error('Name must be 2 to 120 characters.');
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  return supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name: name } } });
}
/** Supabase phone OTP; enable phone auth and configure an SMS provider in Supabase. */
export async function requestPhoneOtp(phone: string) {
  const value = phone.trim(); if (!/^\+[1-9]\d{7,14}$/.test(value)) throw new Error('Use international phone format, for example +919876543210.');
  return supabase.auth.signInWithOtp({ phone: value, options: { shouldCreateUser: true } });
}
export async function verifyPhoneOtp(phone: string, token: string) { return supabase.auth.verifyOtp({ phone: phone.trim(), token: token.trim(), type: 'sms' }); }
export async function signInWithEmail(email: string, password: string) { return supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }); }
export async function signOut() { return supabase.auth.signOut(); }
export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser(); if (authError) throw authError; if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(); if (error) throw error; return data;
}
/** Role is read from the protected profile row, never from user-editable JWT metadata. */
export function onAuthStateChange(callback: (role: UserRole | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) { callback(null); return; }
    // Defer the profile read until Supabase has released the auth event lock.
    setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('role,approval_status').eq('id', session.user.id).maybeSingle();
      callback(data?.approval_status === 'approved' ? data.role : 'citizen');
    }, 0);
  });
}
export async function approveOfficial(userId: string, departmentId: string, approval: ApprovalStatus = 'approved') {
  if (!userId || !departmentId) throw new Error('Official and department are required.');
  const { error } = await supabase.rpc('approve_official', { p_user_id: userId, p_department_id: departmentId, p_approval: approval }); if (error) throw error;
}
export async function requestOfficialAccess(departmentId: string): Promise<void> {
  if (!departmentId) throw new Error('Choose the department you represent.');
  const { error } = await supabase.rpc('request_official_access', { p_department_id: departmentId }); if (error) throw error;
}
