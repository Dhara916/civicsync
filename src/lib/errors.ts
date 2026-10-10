export class AppError extends Error {
  constructor(message: string, public readonly code = 'APP_ERROR') { super(message); this.name = 'AppError'; }
}
export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  const e = error as {code?: string; message?: string; name?: string} | null;
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return 'The request timed out. Check your connection and retry. A write may have reached the database; keep the form open so retries reuse its request ID.';
  switch (e?.code) {
    case '42501': return 'The database denied this action. Check your account approval and department permissions.';
    case 'PGRST202': case '42883': return 'A required backend function is missing. Apply the Person 3 migration and complete the Person 2 integration.';
    case '42P01': case '42703': case 'PGRST205': case 'PGRST204': return 'The backend schema does not match the integration contract. Check docs/PERSON_2_HANDOFF.md before merging.';
    case '40001': return 'This record changed while you were editing it. Reload the current version before submitting again.';
    case '23505': return 'This request or record already exists. Reload to check the saved result before starting a new submission.';
    case '23503': return 'A related record is missing or cannot be removed while other records refer to it.';
  }
  if (e?.message?.includes('Failed to fetch') || e?.message?.includes('NetworkError')) return 'Cannot reach the backend. Check your connection and Supabase configuration.';
  return e?.message || 'The request could not be completed. Please retry.';
}
export function throwIfError(error: unknown): void { if (error) throw new AppError(errorMessage(error), (error as {code?: string}).code); }
