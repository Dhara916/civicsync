import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { initials } from '../lib/format';
import { signOut } from '../services/authService';
import { Icon } from './Icon';
import { Button } from './UI';
import { errorMessage } from '../lib/errors';
export function Navbar({onMenu}: {onMenu: () => void}) {
  const auth = useAuth(), navigate = useNavigate();
  const [query, setQuery] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const search = (e: FormEvent) => { e.preventDefault(); navigate(`/projects?q=${encodeURIComponent(query.trim())}`); };
  const logout = async () => { setBusy(true); setError(''); try { await signOut(); navigate('/'); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } };
  return <><header className="topbar"><button className="icon-button mobile-menu" onClick={onMenu} aria-label="Open navigation"><Icon name="menu"/></button><div className="topbar-context"><span className="tiny-dot"/>Public infrastructure workspace</div><form className="topbar-search" onSubmit={search}><Icon name="search" size={17}/><input aria-label="Search all projects" placeholder="Find a project or road…" value={query} onChange={e => setQuery(e.target.value)} maxLength={120}/><button type="submit" aria-label="Search"><Icon name="arrow" size={16}/></button></form><div className="account-menu">{auth.user ? <><span className="avatar">{initials(auth.profile?.name ?? auth.user.email ?? 'Citizen')}</span><div className="account-name"><strong>{auth.profile?.name ?? 'Signed-in user'}</strong><small>{auth.profile?.role ?? 'Profile unavailable'}</small></div><Button variant="ghost" busy={busy} aria-label="Sign out" onClick={() => void logout()}><Icon name="logout" size={18}/></Button></> : <Link className="btn btn-secondary" to="/sign-in">Sign in</Link>}</div></header>{error && <div className="inline-error topbar-error" role="alert">{error}</div>}</>;
}
