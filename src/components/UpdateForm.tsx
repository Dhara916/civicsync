import { useState, type FormEvent } from 'react';
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '../contracts/database';
import { STATUS_LABELS, transitionAllowed } from '../lib/domain';
import { errorMessage } from '../lib/errors';
import { publishProjectUpdate } from '../services/updateService';
import { announceDataChange } from '../hooks/useResource';
import { Button, Field, Notice } from './UI';
export function UpdateForm({project, saved, cancel}: {project: Project; saved: () => void; cancel: () => void}) {
  const [id] = useState(() => crypto.randomUUID()), [status, setStatus] = useState<ProjectStatus>(project.status);
  const [note, setNote] = useState(''), [delay, setDelay] = useState(''), [endDate, setEndDate] = useState('');
  const [progress, setProgress] = useState(project.progress_percent);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      if (!transitionAllowed(project.status, status)) throw new Error('This project status transition is not allowed.');
      if (status === 'completed' && progress !== 100) throw new Error('Mark a project as complete only at 100% progress.');
      if (endDate && endDate < project.start_date) throw new Error('The revised end date must not precede the project start.');
      await publishProjectUpdate({id, project_id: project.id, expected_version: project.version, status, progress_note: note, progress_percent: progress, delay_reason: delay || null, revised_end_date: endDate || null});
      announceDataChange(); saved();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <section className="panel editor-panel"><div className="section-heading"><div><p className="eyebrow">OFFICIAL UPDATE</p><h2>Publish to the project timeline</h2></div></div><Notice>Publishing saves the update and any revised schedule in one database transaction. Schedule changes automatically recalculate potential conflicts.</Notice><form onSubmit={submit}><div className="form-grid"><Field id="update-status" label="Current status"><select id="update-status" value={status} onChange={e => setStatus(e.target.value as ProjectStatus)} disabled={busy}>{PROJECT_STATUSES.filter(s => transitionAllowed(project.status, s)).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></Field><Field id="update-progress-percent" label="Progress percentage"><input id="update-progress-percent" type="number" min="0" max="100" step="1" value={progress} onChange={e => setProgress(Number(e.target.value))} required disabled={busy}/></Field><Field id="revised-date" label="Revised end date (optional)"><input id="revised-date" type="date" min={project.start_date} value={endDate} onChange={e => setEndDate(e.target.value)} disabled={busy}/></Field></div><Field id="progress-note" label="Public progress note"><textarea id="progress-note" value={note} onChange={e => setNote(e.target.value)} minLength={10} maxLength={3000} rows={4} required disabled={busy}/></Field>{status === 'delayed' && <Field id="delay-reason" label="Reason for the delay"><textarea id="delay-reason" value={delay} onChange={e => setDelay(e.target.value)} minLength={10} maxLength={2000} rows={3} required disabled={busy}/></Field>}{error && <div className="inline-error" role="alert">{error}</div>}<div className="form-actions"><Button variant="secondary" onClick={cancel} disabled={busy}>Cancel</Button><Button type="submit" busy={busy}>Publish update</Button></div></form></section>;
}
