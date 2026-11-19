'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Icon, type IconName } from '../Icon';
import { ActionMenu } from '../ui/Menu';
import { glide } from '../motion/presets';
import type { RecentWorkspace } from '../recent-workspaces';

/* The everyone. frame (Latest design): a black top bar with the lockup, the environment label, the white
   navigation pill and the session; under it a project-frame band that pages fill (the workspace header and
   step bar), then the page. Pages place their own controls in the frame through slots, so every control
   still exists once in the DOM. On phones the navigation pill floats at the bottom as a tab bar. */

export type FrameSlot = 'rail' | 'top';
export type FrameSlots = Record<FrameSlot, HTMLElement | null>;
const SlotContext = createContext<FrameSlots>({ rail: null, top: null });
export const FrameSlotProvider = SlotContext.Provider;

/** Renders children into a frame slot (the project-frame band). Nothing renders until the slot exists. */
export function FramePortal({ slot, children }: { slot: FrameSlot; children: ReactNode }) {
  const target = useContext(SlotContext)[slot];
  return target ? createPortal(children, target) : null;
}

export const destinations: { path: string; label: string; icon: IconName }[] = [
  { path: '/projects', label: 'Projects', icon: 'projects' }, { path: '/library/cast', label: 'Cast Library', icon: 'people' },
  { path: '/presentations', label: 'Presentations', icon: 'slides' }, { path: '/processing', label: 'Processing', icon: 'processing' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

/** One navigation entry. The label is visible text and the link's accessible name; the icon shows on phones. */
export function RailLink({ href, icon, current, children }: { href: string; icon: IconName; current?: 'page' | 'step'; children: ReactNode }) {
  return <Link className="rail-link" href={href} aria-current={current}>
    {current && <motion.span layoutId="studio-nav-current" className="rail-current" transition={glide} aria-hidden="true" />}
    <Icon name={icon} /><span className="rail-label">{children}</span>
  </Link>;
}

/** The navigation pill. The current destination is green; the fill glides between destinations. */
export function IconRail({ pathname }: { pathname: string }) {
  return <nav className="rail" aria-label="Main navigation">
    <ul className="rail-group">
      {destinations.map(item => <li key={item.path}><RailLink href={item.path} icon={item.icon} current={pathname.startsWith(item.path) && !pathname.includes('/casting/') ? 'page' : undefined}>{item.label}</RailLink></li>)}
    </ul>
  </nav>;
}

/** The frame: top bar, the project-frame band pages fill, then the page. */
export function AppFrame({ layout, environment, top, children, setSlot, setStepSlot }: { layout: 'workspace' | 'page'; environment: string; top: ReactNode; children: ReactNode;
  setSlot: (node: HTMLElement | null) => void; setStepSlot: (node: HTMLElement | null) => void }) {
  return <div className="app-frame bi-app" data-layout={layout}>
    {top}
    <div className="development-banner"><span className="status-dot" /><span>{environment}</span></div>
    <div className="frame-head"><div className="frame-top-slot" ref={setSlot} /><div className="rail-slot" ref={setStepSlot} /></div>
    <div className="frame-body">{children}</div>
  </div>;
}

/** Brand lockup, environment label, the navigation pill, recent workspaces and the session. */
export function TopBar({ nav, recent, environment, status, session }: { nav: ReactNode; recent: RecentWorkspace[]; environment: string; status: string;
  session: { name: string; initials: string; signOutLabel: string; onSignOut: () => void } | null }) {
  const router = useRouter();
  return <header className="frame-top">
    <Link className="frame-brand" href="/projects">
      <span className="brand-mark" aria-hidden="true">everyone<span>.</span></span>
      <span className="brand-product" aria-hidden="true">Presentation Studio</span>
      <span className="sr-only">Everyone Presentation Studio home</span>
    </Link>
    <div className="topbar-env" title={environment}><span className="status-dot" /><span>{status}</span></div>
    {nav}
    <div className="frame-top-end">
      {recent.length > 0 && <ActionMenu label="Recent workspaces" align="end" triggerClassName="icon-button rail-button" trigger={<Icon name="history" />}
        items={[{ kind: 'label', label: 'Recent workspaces' }, ...recent.map(item => ({ label: item.name, onSelect: () => router.push(item.href) }))]} />}
      {session && <div className="session-control"><span className="user-initial" aria-hidden="true">{session.initials}</span><span className="user-name">{session.name}</span><button className="icon-button" aria-label={session.signOutLabel} data-tip={session.signOutLabel} data-tip-side="end" onClick={session.onSignOut}><Icon name="logout" /></button></div>}
    </div>
  </header>;
}
