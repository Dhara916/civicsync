import { Link, useSearchParams } from 'react-router-dom';
import { PROJECT_STATUSES, WORK_TYPES, type ProjectStatus, type WorkType } from '../contracts/database';
import { getProjects, getDepartments } from '../services/projectService';
import { useAuth } from '../contexts/AuthContext';
import { useDebounced } from '../hooks/useDebounced';
import { useResource } from '../hooks/useResource';
import { isStaff } from '../lib/permissions';
import { STATUS_LABELS, WORK_LABELS } from '../lib/domain';
import { PageHeading, Button, Loading, ErrorPanel, EmptyState, Pager } from '../components/UI';
import { SearchBar } from '../components/SearchBar';
import { ProjectMap } from '../components/ProjectMap';
import { ProjectTable } from '../components/ProjectTable';
import { Icon } from '../components/Icon';
export default function Projects() {
  const [params, setParams] = useSearchParams(), {profile, user} = useAuth();
  const q = params.get('q') ?? '', query = useDebounced(q);
  const status = PROJECT_STATUSES.includes(params.get('status') as ProjectStatus) ? params.get('status') as ProjectStatus : '';
  const work = WORK_TYPES.includes(params.get('work') as WorkType) ? params.get('work') as WorkType : '';
  const department = params.get('department') ?? '', mapView = params.get('view') === 'map';
  const rawPage = Number(params.get('page') ?? 1), page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const change = (key: string, value: string) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); if (key !== 'page') next.delete('page'); setParams(next, {replace: key === 'q'}); };
  const resource = useResource(`projects:${query}:${status}:${work}:${department}:${page}:${mapView}:${user?.id ?? ''}`, async () => {
    const [projects, departments] = await Promise.all([getProjects({search: query, status, work_type: work, department_id: department, page, pageSize: mapView ? 200 : 20}), getDepartments()]);
    return {projects, departments};
  });
  return <><PageHeading eyebrow="PUBLIC WORKS" title="Project register" description="Find a project, check its official timeline and understand what is happening on your road." actions={isStaff(profile) && <Link to="/projects/new" className="btn btn-primary"><Icon name="plus"/>Register project</Link>}/><section className="panel projects-panel"><div className="filter-bar"><SearchBar value={q} onChange={v => change('q', v)}/><label><span className="sr-only">Project status</span><select aria-label="Project status" value={status} onChange={e => change('status', e.target.value)}><option value="">All statuses</option>{PROJECT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label><label><span className="sr-only">Work type</span><select aria-label="Work type" value={work} onChange={e => change('work', e.target.value)}><option value="">All work types</option>{WORK_TYPES.map(w => <option key={w} value={w}>{WORK_LABELS[w]}</option>)}</select></label><label><span className="sr-only">Department</span><select aria-label="Department" value={department} onChange={e => change('department', e.target.value)}><option value="">All departments</option>{resource.data?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><div className="view-switch" role="group" aria-label="Project view"><button className={!mapView ? 'selected' : ''} onClick={() => change('view', '')} aria-label="Table view" aria-pressed={!mapView}><Icon name="list" size={18}/></button><button className={mapView ? 'selected' : ''} onClick={() => change('view', 'map')} aria-label="Map view" aria-pressed={mapView}><Icon name="map" size={18}/></button></div></div>{(q || status || work || department) && <div className="active-filters"><span>Filters are applied to saved database records.</span><Button variant="ghost" onClick={() => setParams(mapView ? {view: 'map'} : {})}>Clear filters</Button></div>}{resource.loading && <Loading/>}{resource.error && <ErrorPanel message={resource.error} retry={resource.reload}/>} {resource.data && <>{resource.data.projects.items.length ? mapView ? <><ProjectMap projects={resource.data.projects.items} height={560}/><p className="panel-footnote">Map displays this results page, up to 200 projects. Use the pagination below to load more. Records without coordinates remain available in table view.</p></> : <ProjectTable projects={resource.data.projects.items} departments={resource.data.departments}/> : <EmptyState icon="search" title="No matching projects" description="Try a different road, status or department. New work appears only after it is saved to the database."/>}<Pager page={page} total={resource.data.projects.total} pageSize={resource.data.projects.pageSize} onChange={p => change('page', String(p))}/></>}</section></>;
}
