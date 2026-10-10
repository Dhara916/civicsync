import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDepartments } from '../services/projectService';
import { requestOfficialAccess } from '../services/operationsService';
import { useResource } from '../hooks/useResource';
import { errorMessage } from '../lib/errors';
import { Button, ErrorPanel, Field, Loading, Notice, PageHeading } from '../components/UI';
import { humanize } from '../lib/format';

export default function Account() {
  const auth = useAuth();
  const departments = useResource('account-departments', getDepartments);
  const [departmentId, setDepartmentId] = useState(auth.profile?.department_id ?? '');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  if (!auth.profile) return <ErrorPanel message="Your account profile is unavailable." retry={auth.refresh}/>;
  const canRequest = auth.profile.role === 'citizen' || (auth.profile.role === 'official' && auth.profile.approval_status === 'rejected');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      await requestOfficialAccess(departmentId);
      setSuccess('Your official access request was saved. An administrator must approve it before you can manage projects.');
      auth.refresh();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <><PageHeading eyebrow="ACCOUNT & ACCESS" title="Your CivicSync account" description="Your role and department are read from your protected profile."/>
    <section className="panel editor-panel"><h2>Current access</h2><dl className="detail-facts"><div><dt>Role</dt><dd>{humanize(auth.profile.role)}</dd></div><div><dt>Approval</dt><dd>{humanize(auth.profile.approval_status)}</dd></div>{auth.profile.department_id && <div><dt>Department ID</dt><dd><code>{auth.profile.department_id}</code></dd></div>}</dl></section>
    {auth.profile.role === 'official' && auth.profile.approval_status === 'pending' && <Notice tone="warning">Your request is pending. An administrator must approve the department assignment before official tools become available.</Notice>}
    {success && <Notice tone="success">{success}</Notice>}
    {canRequest && <section className="panel editor-panel"><h2>Request official access</h2><p>Choose the municipal or utility department you represent. The account remains a citizen until an administrator approves the request.</p>{departments.loading && <Loading/>}{departments.error && <ErrorPanel message={departments.error} retry={departments.reload}/>} {departments.data && <form onSubmit={submit}><Field id="official-department" label="Department"><select id="official-department" value={departmentId} onChange={e => setDepartmentId(e.target.value)} required disabled={busy}><option value="">Select a department</option>{departments.data.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>{error && <ErrorPanel message={error}/>}<div className="form-actions"><Button type="submit" busy={busy} disabled={!departmentId || departments.data.length === 0}>Submit request</Button></div></form>}</section>}
    {auth.profile.approval_status === 'approved' && auth.profile.role !== 'citizen' && <Notice tone="success">Your approved role can use <Link to="/operations">department operations</Link>.</Notice>}
  </>;
}
