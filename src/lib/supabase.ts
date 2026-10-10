/** Person 2 merge point: one browser client, no privileged keys, no fallback database. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validateEnvironment } from './environment';
import { AppError } from './errors';
export const backendConfiguration = validateEnvironment({
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  legacyKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
const timedFetch: typeof fetch = async (input, init = {}) => {
  const controller = new AbortController();
  const inherited = init.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort(inherited?.reason);
  if (inherited?.aborted) abort();
  else inherited?.addEventListener('abort', abort, {once: true});
  const timer = window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 20000);
  try { return await fetch(input, {...init, signal: controller.signal}); }
  finally { window.clearTimeout(timer); inherited?.removeEventListener('abort', abort); }
};
export const supabase: SupabaseClient | null = backendConfiguration.ready ? createClient(backendConfiguration.url, backendConfiguration.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  global: { fetch: timedFetch },
}) : null;
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new AppError(backendConfiguration.ready ? 'Backend unavailable.' : backendConfiguration.issue, 'NOT_CONFIGURED');
  return supabase;
}
