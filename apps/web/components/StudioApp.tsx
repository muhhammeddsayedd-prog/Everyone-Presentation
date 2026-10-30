'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, mutation, type Session } from './api';
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

const destinations: { path: string; label: string; icon: IconName }[] = [{ path: '/projects', label: 'Projects', icon: 'projects' }, { path: '/library/cast', label: 'Cast Library', icon: 'people' }, { path: '/presentations', label: 'Presentations', icon: 'slides' }, { path: '/processing', label: 'Processing', icon: 'processing' }, { path: '/settings', label: 'Settings', icon: 'settings' }];
const globalEmpty: Record<string, { title: string; body: string; icon: IconName }> = {
  '/presentations': { title: 'No presentations generated', body: 'Presentation versions and real PDF generation are pending M05. Open a project to prepare its casting workspace.', icon: 'slides' },
};

export function StudioApp() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dirtyChanged = useCallback((value: boolean) => setDirty(value), []);
  useEffect(() => {
    let current = true;
    api<Session>('/api/session').then(result => { if (current) { setSession(result.data); setError(''); } }).catch(reason => { if (current) setError(errorMessage(reason)); }).finally(() => { if (current) { setLoading(false); setSigningOut(false); } });
    return () => { current = false; };
  }, [refresh, pathname]);
  useEffect(() => {
    function unload(event: BeforeUnloadEvent) { if (dirty) { event.preventDefault(); event.returnValue = ''; } }
    function navigate(event: MouseEvent) {
      const link = (event.target as HTMLElement).closest('a[href]');
      if (dirty && link && !window.confirm('Some changes are still saving or could not be saved. Leave this page and discard unsaved changes?')) { event.preventDefault(); event.stopPropagation(); }
    }
    window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [dirty]);
  async function signOut() {
    if (dirty && !window.confirm('Leave this workspace and discard unsaved changes?')) return;
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
  const empty = globalEmpty[pathname];
  return <StudioTimeZoneProvider timeZone={session?.timezone}><RuntimeMode.Provider value={central ? "supabase" : "local_fixture"}><><a className="skip-link" href="#main-content">Skip to content</a><div className="app-shell"><aside className="sidebar"><Link className="brand" href="/projects" aria-label="Everyone Presentation Studio home"><img src="/brand/everyone-logotype.svg" alt="everyone." /><span>Presentation Studio</span></Link><div className="nav-caption">Workspace</div><nav className="global-nav" aria-label="Main navigation">{destinations.map(item => <Link href={item.path} key={item.path} aria-current={pathname.startsWith(item.path) ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span>{item.path === '/projects' && <span className="nav-active-dot" />}</Link>)}</nav><div className="sidebar-foot"><span className="badge">{central ? "Central workspace" : confirmedFixture ? "Development" : "Workspace"}</span><p>{central ? <>Authorized projects<br />Everyone account</> : confirmedFixture ? <>Synthetic data<br />Private local workspace</> : <>Opening workspace</>}</p><span className="small muted">Casting · Selection &amp; Shortlist</span></div></aside><div className="app-main"><header className="topbar"><div className="topbar-product"><span>Presentation Studio</span><span className="topbar-divider" /><span className="topbar-module">Casting</span></div>{actor && <div className="session-control"><span className="user-initial" aria-hidden="true">{actor.name.slice(0, 1)}</span><span className="user-name">{actor.name}</span><button className="icon-button" aria-label={central ? "Sign out" : "Sign out of development session"} onClick={signOut}><Icon name="logout" /></button></div>}</header><div className="development-banner"><span className="status-dot" /><span>{central ? "Central Everyone workspace. Development and release verification are in progress." : confirmedFixture ? "Development workspace — synthetic records. Central business integration is unverified." : "Opening your workspace…"}</span></div><main id="main-content" className="main-content" tabIndex={-1}>{loading || signingOut ? <Loading label="Opening Presentation Studio…" /> : error ? <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} /> : !actor ? (central ? <BusinessSignIn /> : <SessionGate actors={session?.actors ?? []} onSignedIn={setSession} />) : isWorkspace ? <WorkspaceView key={`${segments[1]}/${segments[3]}/${segments[4]}`} projectId={segments[1]} workspaceId={segments[3]} step={segments[4]} actor={actor} storageOrigin={session?.storage_origin} onDirtyChange={dirtyChanged} /> : pathname === '/projects' ? <ProjectList /> : pathname === '/library/cast' ? <CastLibraryView actor={actor} onDirtyChange={dirtyChanged} /> : segments[0] === 'library' && segments[1] === 'cast' && segments.length === 3 ? <CandidateDetailView key={segments[2]} candidateId={segments[2]} actor={actor} onDirtyChange={dirtyChanged} /> : central && segments[0] === 'presentations' && segments[1] === 'series' && segments[3] === 'sharing' && segments.length === 4 ? <ReviewSharingView seriesId={segments[2]} actor={actor} onDirtyChange={dirtyChanged} />: central && pathname === '/presentations' ? <PresentationIndex actor={actor} /> : central && segments[0] === 'presentations' && segments[1] === 'versions' && segments.length === 3 ? <><header className="page-heading"><div><h1>Saved presentation</h1></div><Link className="button" href="/presentations">All presentations</Link></header><PresentationVersionView actor={actor} versionId={segments[2]} /></> : central && segments[0] === 'presentations' && segments[1] === 'versions' && segments[3] === 'media' && segments.length === 5 ? <VersionMediaView actor={actor} versionId={segments[2]} assetId={segments[4]} /> : pathname === '/settings' ? <SettingsView actor={actor} onDirtyChange={dirtyChanged} /> : pathname === '/processing' ? <ProcessingView key={actor.id} actor={actor} onDirtyChange={dirtyChanged} /> : empty ? <><header className="page-heading"><div><h1>{destinations.find(item => item.path === pathname)?.label}</h1></div></header><div className="empty-state"><Icon name={empty.icon} /><h2>{empty.title}</h2><p>{empty.body}</p><span className="badge">Implementation pending</span><Link className="button" href="/projects">Open Projects<Icon name="arrow" /></Link></div></> : <div className="empty-state"><h1>Page not found</h1><p>Return to Projects to open an accessible casting workspace.</p><Link className="button" href="/projects">Go to Projects</Link></div>}</main><footer className="app-footer"><span>everyone. Presentation Studio</span><span>{confirmedFixture ? "Synthetic workspace" : "Casting workspace"}</span></footer></div></div></></RuntimeMode.Provider></StudioTimeZoneProvider>;
}
