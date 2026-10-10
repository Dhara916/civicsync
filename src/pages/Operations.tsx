import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDepartments } from '../services/projectService';
import { approveOfficialRequest, getManageableReports, getPendingOfficialRequests, reviewCitizenReport, type ManagedReport, type OfficialApplicant } from '../services/operationsService';
import { useResource } from '../hooks/useResource';
import { errorMessage } from '../lib/errors';
import { formatDateTime, humanize } from '../lib/format';
import { Button, EmptyState, ErrorPanel, Field, Loading, Notice, PageHeading } from '../components/UI';
import type { Department, ReportStatus } from '../contracts/database';

export default function Operations() {
  const {profile} = useAuth();
  const isAdmin = profile?.role === 'admin';
  const resource = useResource(`operations:${profile?.id ?? ''}`, async () => {
    const [departments, applicants, reports] = await Promise.all([
      getDepartments(), isAdmin ? getPendingOfficialRequests() : Promise.resolve([]),
      getManageableReports(profile?.role === 'official' ? profile.department_id : null),
    ]);
    return {departments, applicants, reports};
  });
  return <><PageHeading eyebrow="DEPARTMENT OPERATIONS" title={isAdmin ? 'Administration and report review' : 'Department report review'} description="Official approvals and citizen report decisions are checked by Person 2’s protected database functions."/>
    {resource.loading && <Loading/>}{resource.error && <ErrorPanel message={resource.error} retry={resource.reload}/>}{resource.data && <>
      {isAdmin && <section className="panel"><div className="section-heading"><div><h2>Pending official access</h2><p>Assign a department and approve or reject each request.</p></div></div>{resource.data.applicants.length ? <div className="reports-list">{resource.data.applicants.map(applicant => <ApplicantCard key={applicant.id} applicant={applicant} departments={resource.data!.departments} saved={resource.reload}/>)}</div> : <EmptyState icon="check" title="No pending official requests" description="New requests submitted from Account & access will appear here."/>}</section>}
      <section className="panel"><div className="section-heading"><div><h2>Reports awaiting review</h2><p>{isAdmin ? 'Reports across all departments, subject to database authorization.' : 'Reports linked to projects in your assigned department.'}</p></div><Button variant="secondary" disabled={resource.loading} onClick={resource.reload}>Refresh</Button></div>{resource.data.reports.length ? <div className="reports-list">{resource.data.reports.map(report => <ReportReviewCard key={report.id} report={report} saved={resource.reload}/>)}</div> : <EmptyState icon="reports" title="No reports awaiting review" description="New citizen submissions will appear here."/>}</section>
    </>}</>;
}

function ApplicantCard({applicant, departments, saved}: {applicant: OfficialApplicant; departments: Department[]; saved: () => void}) {
  const [departmentId, setDepartmentId] = useState(applicant.department_id ?? ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const act = async (approval: 'approved' | 'rejected') => {
    setBusy(true); setError('');
    try { await approveOfficialRequest(applicant.id, departmentId, approval); saved(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <article className="report-card"><div className="report-card-top"><span className="report-category">Official access request</span><small>{formatDateTime(applicant.created_at)}</small></div><h3>{applicant.name || 'Name not provided'}</h3><p>Account reference <code>{applicant.id}</code></p><Field id={`department-${applicant.id}`} label="Department"><select id={`department-${applicant.id}`} value={departmentId} onChange={e => setDepartmentId(e.target.value)} disabled={busy} required><option value="">Select a department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>{error && <ErrorPanel message={error}/>}<div className="form-actions"><Button variant="secondary" busy={busy} disabled={!departmentId} onClick={() => void act('rejected')}>Reject</Button><Button busy={busy} disabled={!departmentId} onClick={() => void act('approved')}>Approve official</Button></div></article>;
}

function ReportReviewCard({report, saved}: {report: ManagedReport; saved: () => void}) {
  const [status, setStatus] = useState<Extract<ReportStatus, 'acknowledged' | 'resolved' | 'rejected'>>('acknowledged');
  const [response, setResponse] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await reviewCitizenReport(report.id, status, response); saved(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <article className="report-card"><div className="report-card-top"><span className="report-category">{humanize(report.category)}</span><span>{humanize(report.status)} · {formatDateTime(report.created_at)}</span></div><h3>{report.project.title} · {report.project.road_name}</h3><p className="preserve-lines">{report.description}</p><p>Report reference <code>{report.id}</code></p><form onSubmit={submit}><div className="form-grid"><Field id={`report-status-${report.id}`} label="Review status"><select id={`report-status-${report.id}`} value={status} onChange={e => setStatus(e.target.value as typeof status)} disabled={busy}><option value="acknowledged">Under review</option><option value="resolved">Resolved</option><option value="rejected">Dismissed</option></select></Field></div><Field id={`report-response-${report.id}`} label="Official response (optional)"><textarea id={`report-response-${report.id}`} value={response} onChange={e => setResponse(e.target.value)} maxLength={2000} rows={3} disabled={busy} placeholder="Add a public response for the resident…"/></Field>{error && <ErrorPanel message={error}/>}<div className="form-actions"><Button type="submit" busy={busy}>Save report review</Button></div></form></article>;
}
