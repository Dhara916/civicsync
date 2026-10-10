import { Link } from 'react-router-dom';
import type { ProjectConflict } from '../types/conflict';
import type { Project } from '../contracts/database';
import { StatusBadge } from './StatusBadge';
import { Icon } from './Icon';
import { formatDate } from '../lib/format';
export function ConflictAlert({conflict, projects, compact = false}: {conflict: ProjectConflict; projects: Project[]; compact?: boolean}) {
  const a = projects.find(p => p.id === conflict.project_a_id), b = projects.find(p => p.id === conflict.project_b_id);
  return <article className={`conflict-alert ${compact ? 'compact' : ''}`}><div className="conflict-alert-icon"><Icon name="layers" size={19}/></div><div className="conflict-alert-content"><div className="conflict-title-row"><strong>{a?.road_name ?? b?.road_name ?? 'Potential work overlap'}</strong><StatusBadge status={conflict.status}/></div><p><Link to={`/projects/${conflict.project_a_id}`}>{a?.title ?? 'Project unavailable'}</Link><span className="pair-divider"> + </span><Link to={`/projects/${conflict.project_b_id}`}>{b?.title ?? 'Project unavailable'}</Link></p><small>{formatDate(conflict.overlap_start)} – {formatDate(conflict.overlap_end)}</small>{!compact && <p className="conflict-reason">{conflict.reason}</p>}</div>{compact && <Link to={`/conflicts?project=${conflict.project_a_id}`} className="icon-button" aria-label="Review this overlap"><Icon name="arrow" size={17}/></Link>}</article>;
}
