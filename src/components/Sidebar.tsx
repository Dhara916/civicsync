import { NavLink, Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Icon, type IconName } from './Icon';
import { useAuth } from '../contexts/AuthContext';
const items: {to: string; label: string; icon: IconName}[] = [{to: '/', label: 'Overview', icon: 'dashboard'}, {to: '/projects', label: 'Projects', icon: 'projects'}, {to: '/conflicts', label: 'Dig-Once review', icon: 'layers'}, {to: '/my-reports', label: 'My reports', icon: 'reports'}];
export function Sidebar({open, close}: {open: boolean; close: () => void}) {
  const location = useLocation(), {user, profile} = useAuth();
  const navigation = [...items];
  if (user) navigation.push({to: '/account', label: 'Account & access', icon: 'shield'});
  if (user && profile?.approval_status === 'approved' && (profile.role === 'official' || profile.role === 'admin')) navigation.push({to: '/operations', label: profile.role === 'admin' ? 'Administration' : 'Department reports', icon: 'list'});
  useEffect(() => { close(); }, [location.pathname]);
  useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler); }, [close]);
  return <>{open && <button className="sidebar-overlay" aria-label="Close navigation" onClick={close}/>}<aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Main navigation"><Link className="brand" to="/"><span className="brand-mark"><Icon name="city" size={25}/></span><span>Civic<span className="brand-accent">Sync</span><small>PUBLIC WORKS, IN SYNC</small></span></Link><p className="nav-label">WORKSPACE</p><nav>{navigation.map(item => <NavLink key={item.to} end={item.to === '/'} to={item.to} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}><Icon name={item.icon}/><span>{item.label}</span></NavLink>)}</nav><Link to="/report" className="sidebar-report"><Icon name="plus"/>Report an issue</Link><div className="sidebar-bottom"><div className="coordination-card"><span className="coordination-symbol"><Icon name="layers" size={23}/></span><strong>One road. One plan.</strong><p>See overlapping work early. Coordinate before digging.</p><Link to="/conflicts">Explore Dig-Once <Icon name="arrow" size={15}/></Link></div><Link className="nav-item" to="/setup"><Icon name="settings"/><span>Connection & setup</span></Link><div className="sidebar-footnote"><span className="tiny-dot"/>Transparent by design</div></div></aside></>;
}
