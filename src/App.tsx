import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { AuthGate, BackendGate } from './components/Guards';
import { EmptyState, Loading, Notice } from './components/UI';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'));
const ProjectEditor = lazy(() => import('./pages/ProjectEditor'));
const ReportIssue = lazy(() => import('./pages/ReportIssue'));
const MyReports = lazy(() => import('./pages/MyReports'));
const ConflictReview = lazy(() => import('./pages/ConflictReview'));
const Auth = lazy(() => import('./pages/Auth'));
const Setup = lazy(() => import('./pages/Setup'));
const Account = lazy(() => import('./pages/Account'));
const Operations = lazy(() => import('./pages/Operations'));
function Layout() {
  const [menu, setMenu] = useState(false), close = useCallback(() => setMenu(false), []);
  const location = useLocation(), auth = useAuth();
  useEffect(() => {window.scrollTo(0, 0); document.getElementById('main-content')?.focus({preventScroll: true}); document.title = 'CivicSync · Public works, in sync';}, [location.pathname]);
  return <div className="app-shell"><a href="#main-content" className="skip-link">Skip to content</a><Sidebar open={menu} close={close}/><div className="workspace"><Navbar onMenu={() => setMenu(v => !v)}/><main id="main-content" tabIndex={-1} className="main-content">{auth.profile?.approval_status === 'pending' && <Notice tone="warning">Your account is awaiting approval. Public project information remains available.</Notice>}<Suspense fallback={<Loading label="Opening the workspace…"/>}><Routes><Route path="/setup" element={<Setup/>}/><Route path="/" element={<BackendGate><Dashboard/></BackendGate>}/><Route path="/projects" element={<BackendGate><Projects/></BackendGate>}/><Route path="/projects/new" element={<BackendGate><AuthGate staff><ProjectEditor/></AuthGate></BackendGate>}/><Route path="/projects/:id" element={<BackendGate><ProjectDetails/></BackendGate>}/><Route path="/projects/:id/edit" element={<BackendGate><AuthGate staff><ProjectEditor/></AuthGate></BackendGate>}/><Route path="/report" element={<BackendGate><AuthGate><ReportIssue/></AuthGate></BackendGate>}/><Route path="/my-reports" element={<BackendGate><AuthGate><MyReports/></AuthGate></BackendGate>}/><Route path="/conflicts" element={<BackendGate><ConflictReview/></BackendGate>}/><Route path="/account" element={<BackendGate><AuthGate><Account/></AuthGate></BackendGate>}/><Route path="/operations" element={<BackendGate><AuthGate staff><Operations/></AuthGate></BackendGate>}/><Route path="/sign-in" element={<BackendGate><Auth key="signin" mode="signin"/></BackendGate>}/><Route path="/sign-up" element={<BackendGate><Auth key="signup" mode="signup"/></BackendGate>}/><Route path="/forgot-password" element={<BackendGate><Auth key="forgot" mode="forgot"/></BackendGate>}/><Route path="/reset-password" element={<BackendGate><Auth key="reset" mode="reset"/></BackendGate>}/><Route path="/auth/callback" element={<BackendGate><Auth key="callback" mode="callback"/></BackendGate>}/><Route path="*" element={<EmptyState icon="search" title="This page does not exist" description="Check the address or return to the project overview." action={<Link className="btn btn-primary" to="/">Go to overview</Link>}/>}/></Routes></Suspense></main><footer className="site-footer"><span>CivicSync · Public works, in sync</span><span>Community reporting is not an emergency service.</span></footer></div></div>;
}
export default function App() { return <BrowserRouter><AuthProvider><Layout/></AuthProvider></BrowserRouter>; }
