import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signIn, signUp, resetPassword, changePassword } from '../services/authService';
import { safeReturnPath } from '../lib/validation';
import { errorMessage } from '../lib/errors';
import { Button, Field, Loading, Notice, PageHeading } from '../components/UI';
import { Icon } from '../components/Icon';
export default function Auth({mode}: {mode: 'signin' | 'signup' | 'forgot' | 'reset' | 'callback'}) {
  const auth = useAuth(), navigate = useNavigate(), [params] = useSearchParams();
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [callbackWait, setCallbackWait] = useState(true);
  useEffect(() => {const timer = window.setTimeout(() => setCallbackWait(false), 15000); return () => window.clearTimeout(timer);}, []);
  useEffect(() => {if (mode === 'callback' && auth.user && !auth.loading) navigate('/', {replace: true});}, [auth.user, auth.loading, mode, navigate]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'signin') {await signIn(email, password); auth.refresh(); navigate(safeReturnPath(params.get('returnTo')), {replace: true});}
      if (mode === 'signup') {
        if (password !== confirm) throw new Error('The passwords do not match.');
        const signedIn = await signUp(name, email, password);
        if (signedIn) {auth.refresh(); navigate('/');}
        else setMessage('Check your email for the confirmation link. You can sign in after your registration is confirmed.');
      }
      if (mode === 'forgot') {await resetPassword(email); setMessage('If an account is registered with this email, a password reset message will be sent. Check your inbox and spam folder.');}
      if (mode === 'reset') {if (password !== confirm) throw new Error('The passwords do not match.'); await changePassword(password); setMessage('Your password was updated by the authentication service.'); setPassword(''); setConfirm('');}
    } catch (e) {setError(errorMessage(e));} finally {setBusy(false);}
  };
  const titles = {signin: 'Welcome back.', signup: 'Make your city heard.', forgot: 'Reset your password.', reset: 'Choose a new password.', callback: 'Confirming your account…'};
  if (mode === 'callback') return <div className="auth-wrap"><section className="panel auth-panel"><h1>{titles.callback}</h1>{auth.loading || callbackWait ? <Loading label="Waiting for Supabase authentication…"/> : <Notice tone="warning">The confirmation did not establish a session. The link may be expired, already used or opened in another browser. Request a new confirmation or <Link to="/sign-in">sign in</Link>.</Notice>}{auth.error && <div className="inline-error" role="alert">{auth.error}</div>}</section></div>;
  return <div className="auth-wrap"><section className="panel auth-panel"><span className="brand-mark auth-brand"><Icon name="city" size={28}/></span><PageHeading eyebrow="CIVICSYNC ACCOUNT" title={titles[mode]} description={mode === 'signup' ? 'Register a citizen account to submit and track reports.' : mode === 'signin' ? 'Sign in to contribute or manage your department’s work.' : 'Password changes are handled by Supabase Auth.'}/>{message && <Notice tone="success">{message}</Notice>}{mode === 'reset' && !auth.user && !auth.loading ? <Notice tone="warning">Open the password reset link from your email in the same browser that requested it. <Link to="/forgot-password">Request another link</Link>.</Notice> : <form onSubmit={submit}>{mode === 'signup' && <Field id="account-name" label="Full name"><input id="account-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={100} required disabled={busy}/></Field>}{mode !== 'reset' && <Field id="account-email" label="Email address"><input id="account-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required disabled={busy}/></Field>}{mode !== 'forgot' && <Field id="account-password" label={mode === 'reset' ? 'New password' : 'Password'} hint={mode === 'signup' || mode === 'reset' ? 'Use at least 12 characters. Do not reuse an important account password.' : undefined}><input id="account-password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={mode === 'signin' ? 1 : 12} maxLength={128} required disabled={busy}/></Field>}{(mode === 'signup' || mode === 'reset') && <Field id="confirm-password" label="Confirm password"><input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={12} maxLength={128} required disabled={busy}/></Field>}{error && <div className="inline-error" role="alert">{error}</div>}<Button type="submit" busy={busy} className="full-width">{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create citizen account' : mode === 'forgot' ? 'Send reset link' : 'Update password'}<Icon name="arrow" size={17}/></Button></form>}{mode === 'signin' && <div className="auth-links"><Link to="/forgot-password">Forgot password?</Link><span>New to CivicSync? <Link to="/sign-up">Create an account</Link></span></div>}{mode === 'signup' && <><p className="auth-footnote">Official and administrator roles cannot be self-selected. An administrator must assign a department and approve the role.</p><div className="auth-links"><Link to="/sign-in">Already registered? Sign in</Link></div></>}{(mode === 'forgot' || mode === 'reset') && <div className="auth-links"><Link to="/sign-in">Back to sign in</Link></div>}</section></div>;
}
