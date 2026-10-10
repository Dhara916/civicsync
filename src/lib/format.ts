import { isISODate } from './domain.js';
export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !isISODate(value)) return 'Invalid date';
  const d = new Date(isISODate(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(d.getTime()) ? 'Invalid date' : new Intl.DateTimeFormat('en-IN', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(d);
}
export function formatDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Invalid time' : new Intl.DateTimeFormat('en-IN', {dateStyle: 'medium', timeStyle: 'short'}).format(d);
}
export function initials(name: string): string { return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || 'C'; }
export function daysLate(endDate: string, now = new Date()): number {
  if (!isISODate(endDate)) return 0;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - Date.parse(`${endDate}T00:00:00Z`)) / 86400000));
}
export function humanize(value: string): string { return value.replace(/_/g, ' ').replace(/^./, s => s.toUpperCase()); }
