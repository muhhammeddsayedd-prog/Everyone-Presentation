'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Icon } from '../Icon';
import { useFocusTrap } from '../ui/Overlay';
import { setPanelCollapsed, useMediaQuery, usePanelCollapsed } from './preferences';

/* Page layout inside the frame: an optional config panel (filters, details, settings), the main area, and an
   optional right panel. ≥1280 the panel is a column the viewer can collapse (Ctrl/Cmd+\, remembered);
   below that it opens over the page, and on phones as a bottom sheet. The panel stays mounted at every width
   so edits in it survive a resize. */

export interface PanelSpec { title: string; subtitle?: string; actions?: ReactNode; footer?: ReactNode; body: ReactNode; wide?: boolean; label?: string }

function Trap({ target, onClose }: { target: RefObject<HTMLElement | null>; onClose: () => void }) { useFocusTrap(target, onClose); return null; }

export function PageFrame({ panel, right, children, className }: { panel?: PanelSpec; right?: ReactNode; children: ReactNode; className?: string }) {
  const collapsed = usePanelCollapsed();
  const wide = useMediaQuery('(min-width: 1280px)');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const open = panel ? (wide ? !collapsed : overlayOpen) : false;
  // An overlay opened on a small screen does not carry over to the desktop column (or back).
  const [layoutWide, setLayoutWide] = useState(wide);
  if (layoutWide !== wide) { setLayoutWide(wide); setOverlayOpen(false); }
  useEffect(() => {
    if (!panel) return;
    function key(event: KeyboardEvent) {
      if (event.key !== '\\' || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      event.preventDefault();
      if (wide) setPanelCollapsed(!collapsed); else setOverlayOpen(value => !value);
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [panel, wide, collapsed]);
  function toggle(next: boolean) { if (wide) setPanelCollapsed(!next); else setOverlayOpen(next); }
  const name = panel?.label ?? panel?.title;
  return <div className={`page-frame${className ? ` ${className}` : ''}`} data-panel={panel ? (open ? 'open' : 'closed') : 'none'} data-right={right ? 'open' : undefined}>
    {panel && <>
      {!wide && overlayOpen && <><div className="panel-scrim" aria-hidden="true" onClick={() => setOverlayOpen(false)} /><Trap target={panelRef} onClose={() => { setOverlayOpen(false); toggleRef.current?.focus(); }} /></>}
      <aside ref={panelRef} id={id} className={`config-panel${panel.wide ? ' config-panel-wide' : ''}`} aria-label={name} tabIndex={-1} hidden={!open} data-overlay={!wide ? '' : undefined}>
        <header className="config-panel-head">
          <div><h2>{panel.title}</h2>{panel.subtitle && <p>{panel.subtitle}</p>}</div>
          {panel.actions}
          <button type="button" className="icon-button icon-button-small" aria-label={`Hide ${name}`} aria-controls={id} aria-expanded={open} onClick={() => { toggle(false); toggleRef.current?.focus(); }}><Icon name={wide ? 'chevron-left' : 'close'} /></button>
        </header>
        <div className="config-panel-body">{panel.body}</div>
        {panel.footer && <footer className="config-panel-foot">{panel.footer}</footer>}
      </aside>
    </>}
    <div className="page-frame-main">
      {panel && !open && <button ref={toggleRef} type="button" className="button button-small panel-toggle" aria-controls={id} aria-expanded={false} onClick={() => toggle(true)}><Icon name="panel-left" />Show {name}</button>}
      {children}
    </div>
    {right}
  </div>;
}

/** Contextual details beside the page (≥1280), or a drawer over it on smaller screens. */
export function RightPanel({ title, subtitle, onClose, footer, children, closeLabel }: { title: ReactNode; subtitle?: ReactNode; onClose?: () => void; footer?: ReactNode; children: ReactNode; closeLabel?: string }) {
  const headingId = useId();
  return <aside className="right-panel" aria-labelledby={headingId}>
    <header className="config-panel-head"><div><h2 id={headingId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{onClose && <button type="button" className="icon-button icon-button-small" aria-label={closeLabel ?? 'Close details'} onClick={onClose}><Icon name="close" /></button>}</header>
    <div className="config-panel-body">{children}</div>
    {footer && <footer className="config-panel-foot">{footer}</footer>}
  </aside>;
}
