import { Link } from 'react-router-dom';
import type { Project, Department } from '../contracts/database';
import { formatDate } from '../lib/format';
import { WORK_LABELS } from '../lib/domain';
import { StatusBadge } from './StatusBadge';
import { Icon } from './Icon';
export function ProjectTable({projects, departments}: {projects: Project[]; departments: Department[]}) {
  const names = new Map(departments.map(d => [d.id, d.name]));
  return <div className="table-scroll"><table className="project-table"><thead><tr><th>Project / location</th><th>Department</th><th>Work schedule</th><th>Status</th><th><span className="sr-only">Open project</span></th></tr></thead><tbody>{projects.map(p => <tr key={p.id}><td><Link className="project-title-link" to={`/projects/${p.id}`}>{p.title}</Link><span className="table-subtext"><Icon name="pin" size={13}/>{p.road_name}{p.location ? ` · ${p.location}` : ''}</span></td><td><span>{names.get(p.department_id) ?? 'Department unavailable'}</span><small>{WORK_LABELS[p.work_type]}</small></td><td><span>{formatDate(p.start_date)}</span><small>to {formatDate(p.end_date)}</small></td><td><StatusBadge status={p.status}/></td><td><Link className="icon-button" to={`/projects/${p.id}`} aria-label={`View ${p.title}`}><Icon name="arrow" size={17}/></Link></td></tr>)}</tbody></table></div>;
}
