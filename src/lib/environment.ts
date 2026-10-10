export interface EnvironmentInput { url?: string; key?: string; legacyKey?: string }
export type EnvironmentResult = {ready: true; url: string; key: string} | {ready: false; issue: string};
export function validateEnvironment(input: EnvironmentInput): EnvironmentResult {
  const url = input.url?.trim() ?? '', key = (input.key || input.legacyKey || '').trim();
  if (!url || !key) return {ready: false, issue: 'Add the Supabase URL and browser-safe publishable key to .env.local.'};
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return {ready: false, issue: 'Use an HTTPS Supabase URL, or HTTP for a local Supabase instance. Do not include credentials or query parameters.'};
    }
  } catch { return {ready: false, issue: 'VITE_SUPABASE_URL is not a valid URL.'}; }
  if (key.startsWith('sb_secret_')) return {ready: false, issue: 'A secret key is not allowed in browser code. Remove it and rotate the exposed key.'};
  if (!key.startsWith('sb_publishable_')) {
    try {
      const part = key.split('.')[1];
      const decoded = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
      if (decoded.role !== 'anon') return {ready: false, issue: 'Only a publishable key or a legacy anon key may be used in this frontend.'};
    } catch { return {ready: false, issue: 'The key must be a Supabase publishable key or a legacy anon JWT.'}; }
  }
  return {ready: true, url: url.replace(/\/$/, ''), key};
}
