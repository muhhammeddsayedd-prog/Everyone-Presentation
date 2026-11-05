'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage, mutation, type Actor, type Session } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Icon, type IconName } from './Icon';
import { AppFrame, FrameSlotProvider, IconRail, TopBar, destinations, type FrameSlots } from './shell/Frame';
import { ProjectList } from './ProjectList';
import { ProjectOverview } from './ProjectOverview';
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
import { useRecentWorkspaces } from './recent-workspaces';
import { useRouteFade } from './motion/motion';

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
  const [slots, setSlots] = useState<FrameSlots>({ rail: null, top: null });
  const setStepSlot = useCallback((node: HTMLElement | null) => setSlots(current => current.rail === node ? current : { ...current, rail: node }), []);
  const setTopSlot = useCallback((node: HTMLElement | null) => setSlots(current => current.top === node ? current : { ...current, top: node }), []);
  const recent = useRecentWorkspaces();
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
  const mainRef = useRef<HTMLElement>(null);
  useRouteFade(mainRef, pathname);
  const isWorkspace = segments[0] === 'projects' && segments[2] === 'casting' && segments.length === 5;
  const scopeLabel = isWorkspace ? 'Casting' : destinations.find(item => pathname.startsWith(item.path))?.label ?? 'Studio';
  const environment = central ? 'Central Everyone workspace. Development and release verification are in progress.' : confirmedFixture ? 'Development workspace — synthetic records. Central business integration is unverified.' : 'Opening your workspace…';
  return <StudioTimeZoneProvider timeZone={session?.timezone}><RuntimeMode.Provider value={central ? 'supabase' : 'local_fixture'}><FrameSlotProvider value={slots}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <AppFrame layout={isWorkspace && actor ? 'workspace' : 'page'} environment={environment}
      top={<TopBar setSlot={setTopSlot} product={isWorkspace && actor ? null : scopeLabel} environment={environment} status={central ? 'Release verification in progress' : confirmedFixture ? 'Development · synthetic records' : 'Opening workspace'}
        session={actor ? { name: actor.name, initials: initials(actor.name), signOutLabel: central ? 'Sign out' : 'Sign out of development session', onSignOut: signOut } : null} />}
      rail={<IconRail pathname={pathname} recent={actor ? recent : []} setStepSlot={setStepSlot} initials={actor ? initials(actor.name) : null} />}>
      <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>{loading || signingOut ? <Loading label="Opening Presentation Studio…" /> : error ? <ErrorNotice message={error} retry={() => setRefresh(value => value + 1)} /> : !actor ? (central ? <BusinessSignIn /> : <SessionGate actors={session?.actors ?? []} onSignedIn={setSession} />) : <Route pathname={pathname} segments={segments} isWorkspace={isWorkspace} central={central} actor={actor} storageOrigin={session?.storage_origin} onDirtyChange={dirtyChanged} />}</main>
    </AppFrame>
  </FrameSlotProvider></RuntimeMode.Provider></StudioTimeZoneProvider>;
}

function initials(name: string) { return name.split(/\s+/u).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'; }

function Route({ pathname, segments, isWorkspace, central, actor, storageOrigin, onDirtyChange }: { pathname: string; segments: string[]; isWorkspace: boolean; central: boolean; actor: Actor; storageOrigin?: string; onDirtyChange: (dirty: boolean) => void }) {
  if (isWorkspace) return <WorkspaceView key={`${segments[1]}/${segments[3]}/${segments[4]}`} projectId={segments[1]} workspaceId={segments[3]} step={segments[4]} actor={actor} storageOrigin={storageOrigin} onDirtyChange={onDirtyChange} />;
  if (pathname === '/projects') return <ProjectList actor={actor} onDirtyChange={onDirtyChange} />;
  if (segments[0] === 'projects' && segments.length === 2) return <ProjectOverview key={segments[1]} projectId={segments[1]} actor={actor} onDirtyChange={onDirtyChange} />;
  if (pathname === '/library/cast') return <CastLibraryView actor={actor} onDirtyChange={onDirtyChange} />;
  if (segments[0] === 'library' && segments[1] === 'cast' && segments.length === 3) return <CandidateDetailView key={segments[2]} candidateId={segments[2]} actor={actor} onDirtyChange={onDirtyChange} />;
  if (central && segments[0] === 'presentations' && segments[1] === 'series' && segments[3] === 'sharing' && segments.length === 4) return <ReviewSharingView seriesId={segments[2]} actor={actor} onDirtyChange={onDirtyChange} />;
  if (central && pathname === '/presentations') return <PresentationIndex actor={actor} />;
  if (central && segments[0] === 'presentations' && segments[1] === 'versions' && segments.length === 3) return <PresentationVersionView actor={actor} versionId={segments[2]} onDirtyChange={onDirtyChange} />;
  if (central && segments[0] === 'presentations' && segments[1] === 'versions' && segments[3] === 'media' && segments.length === 5) return <VersionMediaView actor={actor} versionId={segments[2]} assetId={segments[4]} />;
  if (pathname === '/settings') return <SettingsView actor={actor} onDirtyChange={onDirtyChange} />;
  if (pathname === '/processing') return <ProcessingView key={actor.id} actor={actor} onDirtyChange={onDirtyChange} />;
  const empty = globalEmpty[pathname];
  if (empty) return <><header className="page-heading"><div><h1>{destinations.find(item => item.path === pathname)?.label}</h1></div></header><div className="empty-state"><Icon name={empty.icon} /><h2>{empty.title}</h2><p>{empty.body}</p><span className="badge">Implementation pending</span><Link className="button" href="/projects">Open Projects<Icon name="arrow" /></Link></div></>;
  return <div className="system-state"><span className="system-state-code" aria-hidden="true">404</span><h1>Page not found</h1><p>This address does not match a Studio page. Return to Projects to open an accessible casting workspace.</p><div className="button-row"><Link className="button button-primary" href="/projects">Go to Projects</Link><Link className="button button-quiet" href="/library/cast">Open Cast Library</Link></div></div>;
}
