'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage, mutation, type Actor, type Session } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Icon, type IconName } from './Icon';
import { ProjectList } from './ProjectList';
import { SessionGate } from './SessionGate';
import { SettingsView } from './SettingsView';
import { WorkspaceView } from './WorkspaceView';
import { BusinessSignIn } from './BusinessSignIn';
import { RuntimeMode } from './RuntimeMode';
import { StudioTimeZoneProvider } from './StudioTimeZone';
import { ProcessingView } from './ProcessingView';
import { CastLibraryView } from './CastLibraryView';
import { CandidateDetailView } from './CandidateDetailView';
import { PresentationIndex } from './PresentationIndex';
import { PresentationVersionView, VersionMediaView } from './PresentationVersionView';
import { ReviewSharingView } from './ReviewSharingView';
import { ConfirmProvider, useConfirm } from './ui/Confirm';
import { ToastProvider } from './ui/Toast';
import { useFocusTrap } from './ui/Overlay';
import { useRecentWorkspaces } from './recent-workspaces';

const destinations: { path: string; label: string; icon: IconName }[] = [{ path: '/projects', label: 'Projects', icon: 'projects' }, { path: '/library/cast', label: 'Cast Library', icon: 'people' }, { path: '/presentations', label: 'Presentations', icon: 'slides' }, { path: '/processing', label: 'Processing', icon: 'processing' }, { path: '/settings', label: 'Settings', icon: 'settings' }];
const globalEmpty: Record<string, { title: string; body: string; icon: IconName }> = {
  '/presentations': { title: 'No presentations generated', body: 'Presentation versions and real PDF generation are pending M05. Open a project to prepare its casting workspace.', icon: 'slides' },
};
const leaveRequest = { title: 'Leave this page?', description: 'Some changes are still saving or could not be saved. Leaving discards them.', confirmLabel: 'Leave and discard changes', cancelLabel: 'Stay on this page', danger: true };

export function StudioApp() {
  return <ConfirmProvider><ToastProvider><StudioShell /></ToastProvider></ConfirmProvider>;
}

function StudioShell() {
  const pathname = usePathname();
  const router = useRouter();
  const confirm = useConfirm();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [navOpenAt, setNavOpenAt] = useState<string | null>(null);
  const navOpen = navOpenAt === pathname;
  const leaving = useRef(false);
  const dirtyChanged = useCallback((value: boolean) => setDirty(value), []);
  useEffect(() => {
    let current = true;
    api<Session>('/api/session').then(result => { if (current) { setSession(result.data); setError(''); } }).catch(reason => { if (current) setError(errorMessage(reason)); }).finally(() => { if (current) { setLoading(false); setSigningOut(false); } });
    return () => { current = false; };
  }, [refresh, pathname]);
  useEffect(() => { leaving.current = false; }, [pathname]);
  useEffect(() => {
    function unload(event: BeforeUnloadEvent) { if (dirty && !leaving.current) { event.preventDefault(); event.returnValue = ''; } }
    function navigate(event: MouseEvent) {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!dirty || leaving.current || !link || event.defaultPrevented || link.target === '_blank' || link.hasAttribute('download') || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if ((link.getAttribute('href') ?? '').startsWith('#')) return;
      event.preventDefault(); event.stopPropagation();
      void confirm(leaveRequest).then(accepted => {
        if (!accepted) return;
        leaving.current = true;
        const target = new URL(link.href, window.location.href);
        if (target.origin === window.location.origin) router.push(`${target.pathname}${target.search}${target.hash}`); else window.location.assign(target.href);
      });
    }
    window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [dirty, confirm, router]);
  async function signOut() {
    if (dirty && !await confirm({ ...leaveRequest, title: 'Sign out and discard changes?', confirmLabel: 'Sign out and discard changes' })) return;
    setSigningOut(true);
    try {
      await api('/api/session', mutation('DELETE')); setDirty(false);
      if (pathname === '/projects') { setSession(previous => previous ? { ...previous, actor: null } : previous); setSigningOut(false); }
      else router.push('/projects');
    }
    catch (reason) { setError(errorMessage(reason)); setSigningOut(false); }
  }
  const actor = session?.actor;
  const central = session?.mode === 'supabase';
  const confirmedFixture = session?.mode === 'local_fixture';
  const segments = pathname.split('/').filter(Boolean);
  const isWorkspace = segments[0] === 'projects' && segments[2] === 'casting' && segments.length === 5;
  const environment = central ? 'Central Everyone workspace. Development and release verification are in progress.' : confirmedFixture ? 'Development workspace — synthetic records. Central business integration is unverified.' : 'Opening your workspace…';
  const navigation = <Navigation pathname={pathname} actor={actor ?? null} central={central} fixture={confirmedFixture} />;
  return <StudioTimeZoneProvider timeZone={session?.timezone}><RuntimeMode.Provider value={central ? 'supabase' : 'local_fixture'}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="app-shell">
      <aside className="sidebar" aria-label="Studio">{navigation}</aside>
      <div className="app-main">
        <header className="topbar">
          <button type="button" className="icon-button menu-toggle" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpenAt(pathname)}><Icon name="menu" /></button>
          <Link className="topbar-brand" href="/projects" aria-label="Everyone Presentation Studio home"><img src="/brand/everyone-logotype.svg" alt="" /></Link>
          <div className="topbar-product"><span>Presentation Studio</span><span className="topbar-divider" /><span className="topbar-module">Casting</span></div>
          <div className="topbar-env" title={environment}><span className="status-dot" /><span>{central ? 'Release verification in progress' : confirmedFixture ? 'Development · synthetic records' : 'Opening workspace'}</span></div>
          {actor && <div className="session-control"><span className="user-initial" aria-hidden="true">{initials(actor.name)}</span><span className="user-name">{actor.name}</span><button className="icon-button" aria-label={central ? 'Sign out' : 'Sign out of development session'} onClick={signOut}><Icon name="logout" /></button></div>}
        </header>
        <div className="development-banner"><span className="status-dot" /><span>{environment}</span></div>
        <main id="main-content" className="main-content" tabIndex={-1}>{loading || signingOut ? <Loading label="Opening Presentation Studio…" /> : error ? <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} /> : !actor ? (central ? <BusinessSignIn /> : <SessionGate actors={session?.actors ?? []} onSignedIn={setSession} />) : <Route pathname={pathname} segments={segments} isWorkspace={isWorkspace} central={central} actor={actor} storageOrigin={session?.storage_origin} onDirtyChange={dirtyChanged} />}</main>
        <footer className="app-footer"><span>everyone. Presentation Studio</span><span>{confirmedFixture ? 'Synthetic workspace' : 'Casting workspace'}</span></footer>
      </div>
    </div>
    {navOpen && <NavigationSheet onClose={() => setNavOpenAt(null)}>{navigation}</NavigationSheet>}
  </RuntimeMode.Provider></StudioTimeZoneProvider>;
}

function initials(name: string) { return name.split(/\s+/u).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'; }

function Navigation({ pathname, actor, central, fixture }: { pathname: string; actor: Actor | null; central: boolean; fixture: boolean }) {
  const recent = useRecentWorkspaces();
  return <>
    <Link className="brand" href="/projects" aria-label="Everyone Presentation Studio home"><img src="/brand/everyone-logotype.svg" alt="everyone." /><span>Presentation Studio · Casting</span></Link>
    <nav className="global-nav" aria-label="Main navigation">{destinations.map(item => <Link href={item.path} key={item.path} aria-current={pathname.startsWith(item.path) ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>)}</nav>
    {actor && recent.length > 0 && <nav className="recent-nav" aria-label="Recent workspaces"><div className="nav-caption">Recent workspaces</div>{recent.map(item => <Link key={item.workspaceId} href={item.href} aria-current={pathname.startsWith(`/projects/${item.projectId}/casting/${item.workspaceId}`) ? 'page' : undefined}><span>{item.name}</span></Link>)}</nav>}
    <div className="sidebar-foot">
      <p>{central ? 'Authorized projects · Everyone account' : fixture ? 'Synthetic data · private local workspace' : 'Opening workspace'}</p>
      {actor && <div className="session-card"><span className="user-initial" aria-hidden="true">{initials(actor.name)}</span><div><strong>{actor.name}</strong><span>{central ? 'Everyone account' : 'Development identity'}</span></div></div>}
    </div>
  </>;
}

function NavigationSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);
  return <><div className="scrim" onClick={onClose} aria-hidden="true" /><div ref={ref} className="nav-sheet" role="dialog" aria-modal="true" aria-label="Navigation" tabIndex={-1}>
    <div className="nav-sheet-head"><span className="small muted">Menu</span><button type="button" className="icon-button" aria-label="Close navigation" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </div></>;
}

function Route({ pathname, segments, isWorkspace, central, actor, storageOrigin, onDirtyChange }: { pathname: string; segments: string[]; isWorkspace: boolean; central: boolean; actor: Actor; storageOrigin?: string; onDirtyChange: (dirty: boolean) => void }) {
  if (isWorkspace) return <WorkspaceView key={`${segments[1]}/${segments[3]}/${segments[4]}`} projectId={segments[1]} workspaceId={segments[3]} step={segments[4]} actor={actor} storageOrigin={storageOrigin} onDirtyChange={onDirtyChange} />;
  if (pathname === '/projects') return <ProjectList actor={actor} />;
  if (pathname === '/library/cast') return <CastLibraryView actor={actor} onDirtyChange={onDirtyChange} />;
  if (segments[0] === 'library' && segments[1] === 'cast' && segments.length === 3) return <CandidateDetailView key={segments[2]} candidateId={segments[2]} actor={actor} onDirtyChange={onDirtyChange} />;
  if (central && segments[0] === 'presentations' && segments[1] === 'series' && segments[3] === 'sharing' && segments.length === 4) return <ReviewSharingView seriesId={segments[2]} actor={actor} onDirtyChange={onDirtyChange} />;
  if (central && pathname === '/presentations') return <PresentationIndex actor={actor} />;
  if (central && segments[0] === 'presentations' && segments[1] === 'versions' && segments.length === 3) return <><header className="page-heading"><div><h1>Saved presentation</h1></div><Link className="button" href="/presentations">All presentations</Link></header><PresentationVersionView actor={actor} versionId={segments[2]} /></>;
  if (central && segments[0] === 'presentations' && segments[1] === 'versions' && segments[3] === 'media' && segments.length === 5) return <VersionMediaView actor={actor} versionId={segments[2]} assetId={segments[4]} />;
  if (pathname === '/settings') return <SettingsView actor={actor} onDirtyChange={onDirtyChange} />;
  if (pathname === '/processing') return <ProcessingView key={actor.id} actor={actor} onDirtyChange={onDirtyChange} />;
  const empty = globalEmpty[pathname];
  if (empty) return <><header className="page-heading"><div><h1>{destinations.find(item => item.path === pathname)?.label}</h1></div></header><div className="empty-state"><Icon name={empty.icon} /><h2>{empty.title}</h2><p>{empty.body}</p><span className="badge">Implementation pending</span><Link className="button" href="/projects">Open Projects<Icon name="arrow" /></Link></div></>;
  return <div className="empty-state"><h1>Page not found</h1><p>Return to Projects to open an accessible casting workspace.</p><Link className="button" href="/projects">Go to Projects</Link></div>;
}
