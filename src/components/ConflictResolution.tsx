import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ProjectConflict } from '../types/conflict';
import { resolveConflict } from '../services/conflictService';
import { errorMessage } from '../lib/errors';
import { announceDataChange } from '../hooks/useResource';
import { Button, Field, Notice } from './UI';
import { Icon } from './Icon';
export function ConflictResolution({conflict, close, saved}: {conflict: ProjectConflict; close: () => void; saved: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [requestId] = useState(() => crypto.randomUUID()), [note, setNote] = useState(''), [decision, setDecision] = useState<'resolved' | 'dismissed'>('resolved');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { await resolveConflict(conflict.id, {request_id: requestId, status: decision, note, expected_version: conflict.version}); announceDataChange(); saved(); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="resolution-dialog" aria-labelledby="resolution-title" onCancel={e => {e.preventDefault(); if (!busy) close();}}><div className="dialog-heading"><div><p className="eyebrow">OFFICIAL REVIEW</p><h2 id="resolution-title">Record a coordination decision</h2></div><button disabled={busy} className="icon-button" onClick={close} aria-label="Close review"><Icon name="close"/></button></div><p>{conflict.reason}</p><Notice>This records your decision. It does not change either project’s dates. Publish an official update or edit the schedule separately. Material changes will reopen this alert.</Notice><form onSubmit={submit}><Field id="decision" label="Decision"><select id="decision" value={decision} onChange={e => setDecision(e.target.value as typeof decision)} disabled={busy}><option value="resolved">Coordination agreed — mark resolved</option><option value="dismissed">Not a practical conflict — dismiss with reason</option></select></Field><Field id="resolution-note" label="Public decision note" hint="Explain the agreed sequence, coordination, or reason for dismissal. Do not include private contact details. Minimum 20 characters."><textarea id="resolution-note" value={note} onChange={e => setNote(e.target.value)} minLength={20} maxLength={2000} rows={5} required disabled={busy} autoFocus/></Field>{error && <div className="inline-error" role="alert">{error}</div>}<div className="form-actions"><Button variant="secondary" disabled={busy} onClick={close}>Cancel</Button><Button type="submit" busy={busy}>Save decision</Button></div></form></dialog>;
}
