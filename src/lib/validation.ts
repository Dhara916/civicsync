import { PROJECT_STATUSES, REPORT_CATEGORIES, WORK_TYPES, type ProjectDraft, type ReportDraft, type UpdateDraft, type WorkGeometry } from '../contracts/database.js';
import { isISODate } from './domain.js';
export class ValidationError extends Error { constructor(message: string) { super(message); this.name = 'ValidationError'; } }
export function assertUUID(value: string, label = 'ID'): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ValidationError(`${label} must be a valid UUID.`);
}
export function assertText(value: unknown, label: string, min: number, max: number): asserts value is string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new ValidationError(`${label} must contain ${min}–${max} characters.`);
}
export function assertCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new ValidationError('Choose valid latitude (−90 to 90) and longitude (−180 to 180).');
}
export function parseGeometry(value: unknown): WorkGeometry {
  if (!value || typeof value !== 'object' || !('type' in value) || !('coordinates' in value)) throw new ValidationError('Work geometry must be a GeoJSON Point or LineString.');
  const g = value as {type: unknown; coordinates: unknown};
  if (g.type !== 'Point' && g.type !== 'LineString') throw new ValidationError('Only Point and LineString work geometry is supported.');
  const points = g.type === 'Point' ? [g.coordinates] : g.coordinates;
  if (!Array.isArray(points) || (g.type === 'LineString' && (points.length < 2 || points.length > 200))) throw new ValidationError('A work line needs 2–200 points.');
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2 || typeof point[0] !== 'number' || typeof point[1] !== 'number') throw new ValidationError('Every point must be [longitude, latitude].');
    assertCoordinates(point[1], point[0]);
  }
  if (g.type === 'LineString' && new Set(points.map(p => JSON.stringify(p))).size < 2) throw new ValidationError('A work line needs at least two distinct points.');
  return value as WorkGeometry;
}
export function validateProject(d: ProjectDraft): void {
  assertUUID(d.id); assertUUID(d.department_id, 'Department');
  assertText(d.title, 'Project title', 5, 160); assertText(d.road_name, 'Road name', 2, 160);
  assertText(d.location, 'Locality', 2, 200);
  if (!WORK_TYPES.includes(d.work_type) || !PROJECT_STATUSES.includes(d.status)) throw new ValidationError('Choose a valid work type and status.');
  if (!isISODate(d.start_date) || !isISODate(d.end_date) || d.end_date < d.start_date) throw new ValidationError('Enter valid start and end dates. The end must not precede the start.');
  assertCoordinates(d.latitude, d.longitude);
  if (d.road_segment_id && d.road_segment_id.length > 120) throw new ValidationError('Road segment ID must not exceed 120 characters.');
  if (d.work_geometry) {
    const g = parseGeometry(d.work_geometry);
    const first = g.type === 'Point' ? g.coordinates : g.coordinates[0];
    if (Math.abs(first[0] - d.longitude) > 0.000001 || Math.abs(first[1] - d.latitude) > 0.000001) throw new ValidationError('The map pin must match the first coordinate of the saved work geometry.');
  }
}
export function validateReport(d: ReportDraft): void {
  assertUUID(d.id); assertUUID(d.project_id, 'Project');
  if (!REPORT_CATEGORIES.includes(d.category)) throw new ValidationError('Choose a valid report category.');
  assertText(d.description, 'Report description', 20, 3000);
}
export function validateUpdate(d: UpdateDraft): void {
  assertUUID(d.id); assertUUID(d.project_id, 'Project');
  if (!Number.isInteger(d.expected_version) || d.expected_version < 1) throw new ValidationError('Reload the project before publishing an update.');
  if (!PROJECT_STATUSES.includes(d.status)) throw new ValidationError('Choose a valid status.');
  if (!Number.isInteger(d.progress_percent) || d.progress_percent < 0 || d.progress_percent > 100 || (d.status === 'completed' && d.progress_percent !== 100)) throw new ValidationError('Progress must be a whole number from 0 to 100; completed projects must be at 100%.');
  assertText(d.progress_note, 'Progress note', 10, 3000);
  if (d.status === 'delayed') assertText(d.delay_reason, 'Delay reason', 10, 2000);
  else if (d.delay_reason) assertText(d.delay_reason, 'Delay reason', 1, 2000);
  if (d.revised_end_date && !isISODate(d.revised_end_date)) throw new ValidationError('Enter a valid revised end date.');
}
export function safeSearch(value: string): string {
  // Escape LIKE wildcards and strip PostgREST grammar rather than interpolating it.
  return value.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}
export function safeReturnPath(value: string | null | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !/[\\\r\n]/.test(value) ? value : '/';
}
