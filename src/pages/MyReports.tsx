import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMyReports } from '../services/reportService';
import { getProjectsByIds } from '../services/projectService';
import { useResource } from '../hooks/useResource';
import { formatDateTime, humanize } from '../lib/format';
import { Button, EmptyState, ErrorPanel, Loading, PageHeading, Pager } from '../components/UI';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
export default function MyReports() {
  const {user} = useAuth(), [page, setPage] = useState(1);
  const resource = useResource(`my-reports:${user?.id}:${page}`, async () => {const reports = await getMyReports(page); const projects = await getProjectsByIds(reports.items.map(r => r.project_id)); return {reports, projects};}, {pollMs: 60000});
  return <><PageHeading eyebrow="MY CONTRIBUTIONS" title="My reports" description="Your submitted observations and their latest saved review status." actions={<><Button variant="secondary" onClick={resource.reload} disabled={resource.loading}><Icon name="refresh" size={16}/>Refresh</Button><Link className="btn btn-primary" to="/report"><Icon name="plus" size={18}/>Report an issue</Link></>}/>{resource.loading && <Loading/>}{resource.error && <ErrorPanel message={resource.error} retry={resource.reload}/>} {resource.data && <section className="panel">{resource.data.reports.items.length ? <div className="reports-list">{resource.data.reports.items.map(report => <article className="report-card" key={report.id}><div className="report-card-top"><span className="report-category">{humanize(report.category)}</span><StatusBadge status={report.status}/></div><h2><Link to={`/projects/${report.project_id}`}>{resource.data!.projects.find(p => p.id === report.project_id)?.title ?? 'Project unavailable'}</Link></h2><p className="preserve-lines">{report.description}</p><div className="report-card-footer"><time dateTime={report.created_at}>{formatDateTime(report.created_at)}</time><code title={report.id}>#{report.id.slice(0, 8)}</code></div></article>)}</div> : <EmptyState icon="reports" title="You haven’t submitted a report yet" description="Report an issue against a registered project. Your saved reports will appear here." action={<Link className="btn btn-primary" to="/report">Submit your first report</Link>}/>}<Pager page={page} total={resource.data.reports.total} pageSize={resource.data.reports.pageSize} onChange={setPage}/></section>}</>;
}
