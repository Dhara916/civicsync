import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { backendConfiguration } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { isStaff } from '../lib/permissions';
import { EmptyState, ErrorPanel, Loading } from './UI';
import Setup from '../pages/Setup';
export function BackendGate({children}: {children: ReactNode}) { return backendConfiguration.ready ? <>{children}</> : <Setup/>; }
export function AuthGate({children, staff = false}: {children: ReactNode; staff?: boolean}) {
  const auth = useAuth(), location = useLocation();
  if (auth.loading) return <Loading label="Checking your account…"/>;
  if (auth.error) return <ErrorPanel message={auth.error} retry={auth.refresh}/>;
  if (!auth.user) return <EmptyState icon="shield" title="Sign in to continue" description="Public projects and coordination alerts are open to everyone. A verified account is needed to submit reports or make changes." action={<Link className="btn btn-primary" to={`/sign-in?returnTo=${encodeURIComponent(location.pathname + location.search)}`}>Sign in</Link>}/>;
  if (!auth.profile) return <ErrorPanel message="Your database profile is missing. Contact the backend administrator." retry={auth.refresh}/>;
  if (auth.profile.approval_status !== 'approved') return <EmptyState icon="clock" title={auth.profile.approval_status === 'pending' ? 'Account approval pending' : 'Account is not approved'} description="An administrator must approve your profile before you can make changes."/>;
  if (staff && !isStaff(auth.profile)) return <EmptyState icon="shield" title="Official access required" description="Only approved officials assigned to a department, or administrators, can manage public works. Roles are controlled by the backend, not by this page."/>;
  return <>{children}</>;
}
