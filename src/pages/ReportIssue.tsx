import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { REPORT_CATEGORIES, type CitizenReport, type Project, type ReportCategory } from '../contracts/database';
import { submitReport } from '../services/reportService';
import { getProject } from '../services/projectService';
import { errorMessage } from '../lib/errors';
import { humanize } from '../lib/format';
import { useResource, announceDataChange } from '../hooks/useResource';
import { Button, ErrorPanel, Field, Loading, Notice, PageHeading } from '../components/UI';
import { ProjectPicker } from '../components/ProjectPicker';
import { Icon } from '../components/Icon';
export default function ReportIssue() {
  const [params] = useSearchParams(), initialId = params.get('project');
  const initial = useResource(`report-project:${initialId}`, () => getProject(initialId!), {enabled: !!initialId});
  const [requestId] = useState(() => crypto.randomUUID()), [project, setProject] = useState<Project | null>(null);
  const [category, setCategory] = useState<ReportCategory>('safety_hazard'), [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState<CitizenReport | null>(null);
  useEffect(() => {if (initial.data) setProject(initial.data);}, [initial.data]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {if (!project) throw new Error('Choose the project involved before submitting.'); const report = await submitReport({id: requestId, project_id: project.id, category, description}); setSaved(report); announceDataChange();}
    catch (e) {setError(errorMessage(e));} finally {setBusy(false);}
  };
  return <><PageHeading eyebrow="CITIZEN VOICE" title={saved ? 'Your report is on record.' : 'Report an issue'} description="Give the responsible department a clear, specific account of what you observed."/>{saved ? <section className="panel success-panel"><span className="success-symbol"><Icon name="check" size={34}/></span><h2>Report submitted to the database</h2><p>Reference: <code>{saved.id}</code></p><p>Your report status is <strong>{humanize(saved.status)}</strong>. Track it from My reports; the page reflects the status saved by the backend.</p><Link className="btn btn-primary" to="/my-reports">View my reports <Icon name="arrow" size={17}/></Link></section> : <div className="form-layout"><section className="panel editor-panel"><form onSubmit={submit}><div className="form-section-title"><span>01</span><div><h2>Select a project</h2><p>Reports are linked to an existing public work.</p></div></div>{initial.loading && <Loading label="Loading the linked project…"/>}{initial.error && <ErrorPanel message={initial.error} retry={initial.reload}/>}<ProjectPicker selected={project} onSelect={setProject} disabled={busy}/><div className="form-section-title"><span>02</span><div><h2>Tell us what happened</h2><p>Describe the location and the issue, not assumptions about who caused it.</p></div></div><Field id="report-category" label="Issue category"><select id="report-category" value={category} onChange={e => setCategory(e.target.value as ReportCategory)} disabled={busy}>{REPORT_CATEGORIES.map(c => <option key={c} value={c}>{humanize(c)}</option>)}</select></Field><Field id="report-description" label="What did you observe?" hint="Include a landmark, when you noticed the issue and how it affects access or safety. Do not include sensitive personal information."><textarea id="report-description" rows={7} value={description} onChange={e => setDescription(e.target.value)} minLength={20} maxLength={3000} required disabled={busy} placeholder="Describe the problem clearly…"/></Field><p className="character-count">{description.length}/3000 characters</p>{error && <div className="inline-error" role="alert">{error}</div>}<div className="form-actions"><Link to="/projects" className="text-link">Back to projects</Link><Button type="submit" busy={busy} disabled={!project}><Icon name="reports" size={17}/>Submit report</Button></div></form></section><aside className="form-aside"><Notice tone="warning"><strong>Not an emergency service.</strong><p>For an immediate danger, contact the appropriate local emergency service. Do not wait for a response here.</p></Notice><section className="panel"><Icon name="shield" size={25}/><h3>Your reports stay linked to you</h3><p>My reports only requests records belonging to your signed-in account. Person 2’s database policies must enforce that boundary.</p><p>Reports are observations. They do not replace official project updates or automatically prove a fault.</p></section><section className="panel"><h3>What happens next?</h3><p>The report is saved with a submitted status. Department review and any status change depend on the backend workflow supplied by Person 2.</p></section></aside></div>}</>;
}
