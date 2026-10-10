import { humanize } from '../lib/format';
import { STATUS_LABELS } from '../lib/domain';
import type { ProjectStatus } from '../contracts/database';
export function StatusBadge({status}: {status: string}) { return <span className={`status-badge status-${status}`}><span className="status-dot"/>{STATUS_LABELS[status as ProjectStatus] ?? humanize(status)}</span>; }
