'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../Icon';
import { ActionMenu } from '../ui/Menu';
import { SegmentIndicator } from '../motion/SegmentIndicator';
import type { RecentWorkspace } from '../recent-workspaces';

/* Presentation-first frame: top bar, a permanent icon rail, then the page (or a config panel, stage and right panel).
   Pages place their own controls in the frame through slots, so every control still exists once in the DOM. */

export type FrameSlot = 'rail' | 'top';
export type FrameSlots = Record<FrameSlot, HTMLElement | null>;
const SlotContext = createContext<FrameSlots>({ rail: null, top: null });
export const FrameSlotProvider = SlotContext.Provider;

/** Renders children into a frame slot (the rail's step group or the top bar). Nothing renders until the slot exists. */
export function FramePortal({ slot, children }: { slot: FrameSlot; children: ReactNode }) {
  const target = useContext(SlotContext)[slot];
  return target ? createPortal(children, target) : null;
}

export const destinations: { path: string; label: string; icon: IconName }[] = [
  { path: '/projects', label: 'Projects', icon: 'projects' }, { path: '/library/cast', label: 'Cast Library', icon: 'people' },
  { path: '/presentations', label: 'Presentations', icon: 'slides' }, { path: '/processing', label: 'Processing', icon: 'processing' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

/** One rail entry: icon only on screen; the label is a hover/focus tooltip and stays the link's accessible name. */
export function RailLink({ href, icon, current, children }: { href: string; icon: IconName; current?: 'page' | 'step'; children: ReactNode }) {
  return <Link className="rail-link" href={href} aria-current={current}><Icon name={icon} /><span className="rail-label">{children}</span></Link>;
}

export function IconRail({ pathname, recent, setStepSlot, initials }: { pathname: string; recent: RecentWorkspace[]; setStepSlot: (node: HTMLElement | null) => void; initials: string | null }) {
  const router = useRouter();
  return <aside className="rail" aria-label="Studio">
    <nav className="rail-group" aria-label="Main navigation"><SegmentIndicator />
      {destinations.map(item => <RailLink key={item.path} href={item.path} icon={item.icon} current={pathname.startsWith(item.path) && !pathname.includes('/casting/') ? 'page' : undefined}>{item.label}</RailLink>)}
    </nav>
    <div className="rail-slot" ref={setStepSlot} />
    <div className="rail-foot">
      {recent.length > 0 && <ActionMenu label="Recent workspaces" align="side" triggerClassName="rail-button" trigger={<Icon name="history" />}
        items={[{ kind: 'label', label: 'Recent workspaces' }, ...recent.map(item => ({ label: item.name, onSelect: () => router.push(item.href) }))]} />}
      {initials && <span className="user-initial rail-avatar" aria-hidden="true">{initials}</span>}
    </div>
  </aside>;
}

/** The frame: top bar, an environment line on phones, then the rail beside the page. */
export function AppFrame({ layout, environment, top, rail, children }: { layout: 'workspace' | 'page'; environment: string; top: ReactNode; rail: ReactNode; children: ReactNode }) {
  return <div className="app-frame" data-layout={layout}>
    {top}
    <div className="development-banner"><span className="status-dot" /><span>{environment}</span></div>
    <div className="frame-body">{rail}{children}</div>
  </div>;
}

/** Brand, a slot pages fill (the workspace header) or the area name, environment status and the session. */
export function TopBar({ setSlot, product, environment, status, session }: { setSlot: (node: HTMLElement | null) => void; product: string | null; environment: string; status: string;
  session: { name: string; initials: string; signOutLabel: string; onSignOut: () => void } | null }) {
  return <header className="frame-top">
    <Link className="frame-brand" href="/projects"><span className="brand-mark" aria-hidden="true">e<span>.</span></span><span className="sr-only">Everyone Presentation Studio home</span></Link>
    <div className="frame-top-slot" ref={setSlot}>{product && <div className="topbar-product"><strong>{product}</strong><span>everyone. Presentation Studio</span></div>}</div>
    <div className="topbar-env" title={environment}><span className="status-dot" /><span>{status}</span></div>
    {session && <div className="session-control"><span className="user-initial" aria-hidden="true">{session.initials}</span><span className="user-name">{session.name}</span><button className="icon-button" aria-label={session.signOutLabel} onClick={session.onSignOut}><Icon name="logout" /></button></div>}
  </header>;
}
