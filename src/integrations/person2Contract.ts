import type { ProjectStatus, ReportCategory, ReportStatus, WorkType } from '../contracts/database.js';

/** Explicit adapters for Person 2's existing PostgreSQL enums and column names. */
export function toDatabaseProjectStatus(status: ProjectStatus): string { return status === 'in_progress' ? 'ongoing' : status; }
export function fromDatabaseProjectStatus(value: unknown): ProjectStatus {
  if (value === 'ongoing') return 'in_progress';
  if (value === 'planned' || value === 'delayed' || value === 'completed' || value === 'cancelled') return value;
  throw new Error(`Unsupported Person 2 project status: ${String(value)}`);
}

export function toDatabaseWorkType(workType: WorkType): string { return workType; }
export function databaseWorkTypeFilter(workType: WorkType): string[] {
  switch (workType) {
    case 'water': return ['water', 'water_pipeline'];
    case 'sewer': return ['sewer', 'sewer_drainage'];
    case 'drainage': return ['drainage', 'sewer_drainage'];
    case 'road_resurfacing': return ['road_resurfacing', 'road_repair'];
    default: return [workType];
  }
}
export function fromDatabaseWorkType(value: unknown): WorkType {
  switch (value) {
    case 'water_pipeline': return 'water';
    case 'sewer_drainage': return 'sewer_drainage';
    case 'road_repair': return 'road_resurfacing';
    case 'water': case 'sewer': case 'drainage': case 'electricity': case 'telecom':
    case 'road_resurfacing': case 'excavation': case 'inspection': case 'other': return value;
    default: throw new Error(`Unsupported Person 2 work type: ${String(value)}`);
  }
}

export function toDatabaseReportCategory(category: ReportCategory): string { return category; }
export function fromDatabaseReportCategory(value: unknown): ReportCategory {
  switch (value) {
    case 'quality': case 'safety': case 'delay': case 'damage':
    case 'safety_hazard': case 'road_damage': case 'water_leak': case 'access_blocked': case 'noise': case 'other': return value;
    default: throw new Error(`Unsupported Person 2 report category: ${String(value)}`);
  }
}

export function fromDatabaseReportStatus(value: unknown): ReportStatus {
  switch (value) {
    case 'open': return 'submitted';
    case 'under_review': return 'acknowledged';
    case 'resolved': return 'resolved';
    case 'dismissed': return 'rejected';
    default: throw new Error(`Unsupported Person 2 report status: ${String(value)}`);
  }
}
