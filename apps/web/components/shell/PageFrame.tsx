'use client';

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { Icon } from '../Icon';
import { useFocusTrap } from '../ui/Overlay';
import { setPanelCollapsed, setPanelWidth, useMediaQuery, usePanelCollapsed, usePanelWidth, type PanelKind } from './preferences';

/* Page layout inside the frame: an optional config panel (filters, details, settings), the main area, and an
   optional right panel. ≥1280 the panel is a column the viewer can collapse (Ctrl/Cmd+\, remembered);
   below that it opens over the page, and on phones as a bottom sheet. The panel stays mounted at every width
   so edits in it survive a resize. An `inline` panel (the workspace editor) is the page's main content, so below
   1280 it stays in the page flow above the main area instead of hiding behind a toggle. */

/** `filters` marks a filter panel: it starts closed on every visit and opens from the filter button the page
 * places in its toolbar (`<PanelToggle />`), showing how many filters are applied. */
export interface PanelSpec { title: string; subtitle?: string; actions?: ReactNode; footer?: ReactNode; body: ReactNode; wide?: boolean; label?: string; filters?: { count?: number } }

interface PanelControlValue { open: boolean; filters: boolean; count: number; id: string; name: string; toggle: (next: boolean) => void; claim: () => () => void; registerToggle: (node: HTMLButtonElement | null) => (() => void) | undefined }
const PanelControl = createContext<PanelControlValue | null>(null);

/** The page's panel toggle, placed by the page (a toolbar, the stage bar). A filter panel's toggle is always shown and
 * reflects the open state; any other panel's "Show" button appears only while that panel is closed. */
export function PanelToggle({ fallback = false }: { fallback?: boolean }) {
  const control = useContext(PanelControl);
  const claim = fallback ? undefined : control?.claim;
  useLayoutEffect(() => claim?.(), [claim]);
  if (!control) return null;
  const { open, filters, count, id, name, toggle, registerToggle } = control;
  if (filters) return <button ref={registerToggle} type="button" className="icon-button filter-toggle" aria-label={count ? `${name} · ${count} applied` : name} aria-expanded={open} aria-controls={id} data-tip={open ? 'Hide filters' : 'Show filters'} data-tip-side="end" onClick={() => toggle(!open)}>
    <Icon name="filter" />{count > 0 && <span className="filter-toggle-count" aria-hidden="true">{count}</span>}</button>;
  if (open) return null;
  return <button ref={registerToggle} type="button" className="icon-button panel-toggle" aria-label={`Show ${name}`} aria-controls={id} aria-expanded={false} data-tip={`Show ${name}`} onClick={() => toggle(true)}><Icon name="panel-left" /></button>;
}

/* The panel can be widened or narrowed by dragging its edge (or with the arrow keys on the handle). Only the grid's
   panel column changes; the stage, slides, strip and right panel are fluid and follow it. The stage always keeps room. */
const MIN_PANEL = 280, MAX_PANEL = 900, MIN_MAIN = 480;
const maxPanel = () => Math.max(MIN_PANEL, Math.min(MAX_PANEL, window.innerWidth - 64 - MIN_MAIN));
const clampPanel = (value: number) => Math.round(Math.max(MIN_PANEL, Math.min(maxPanel(), value)));
const widthVar = (kind: PanelKind) => kind === 'wide' ? '--panel-width-wide' : '--panel-width';
function PanelResizer({ kind, label, panel, frame }: { kind: PanelKind; label: string; panel: RefObject<HTMLElement | null>; frame: RefObject<HTMLDivElement | null> }) {
  const [width, setWidth] = useState<number | null>(null); const [max, setMax] = useState(MAX_PANEL); const drag = useRef<{ x: number; width: number; last: number } | null>(null);
  useEffect(() => {
    const element = panel.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => { setWidth(Math.round(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width)); setMax(maxPanel()); });
    observer.observe(element); return () => observer.disconnect();
  }, [panel]);
  function apply(value: number) { frame.current?.style.setProperty(widthVar(kind), `${value}px`); }
  function commit(value: number | null) { if (value === null) frame.current?.style.removeProperty(widthVar(kind)); setPanelWidth(kind, value); }
  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !panel.current) return; event.preventDefault();
    const start = panel.current.getBoundingClientRect().width; drag.current = { x: event.clientX, width: start, last: start };
    event.currentTarget.setPointerCapture(event.pointerId); document.documentElement.dataset.resizingPanel = '';
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return; const next = clampPanel(drag.current.width + event.clientX - drag.current.x); drag.current.last = next; apply(next);
  }
  function up() { if (!drag.current) return; const last = drag.current.last; drag.current = null; delete document.documentElement.dataset.resizingPanel; commit(last); }
  function keys(event: ReactKeyboardEvent<HTMLDivElement>) {
    const current = panel.current?.getBoundingClientRect().width ?? width ?? MIN_PANEL; const step = event.shiftKey ? 64 : 16;
    const next = event.key === 'ArrowRight' ? current + step : event.key === 'ArrowLeft' ? current - step : event.key === 'Home' ? MIN_PANEL : event.key === 'End' ? maxPanel() : null;
    if (event.key === 'Enter') { event.preventDefault(); commit(null); return; }
    if (next === null) return; event.preventDefault(); const value = clampPanel(next); apply(value); commit(value);
  }
  return <div className="panel-resizer" role="separator" aria-orientation="vertical" aria-label={`Resize ${label}`} aria-valuemin={MIN_PANEL} aria-valuemax={max} aria-valuenow={width ?? undefined}
    aria-valuetext={width ? `${width} pixels wide` : undefined} title="Drag to resize · double-click to reset" tabIndex={0}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={keys} onDoubleClick={() => commit(null)} />;
}

function Trap({ target, onClose }: { target: RefObject<HTMLElement | null>; onClose: () => void }) { useFocusTrap(target, onClose); return null; }

export function PageFrame({ panel, right, children, className, inline = false }: { panel?: PanelSpec; right?: ReactNode; children: ReactNode; className?: string; inline?: boolean }) {
  const collapsed = usePanelCollapsed();
  const wide = useMediaQuery('(min-width: 1280px)');
  const [overlayOpen, setOverlayOpen] = useState(false);
  // Filter panels are not the shared "panel collapsed" preference: they start closed on every visit.
  const filters = !!panel?.filters; const [filtersOpen, setFiltersOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null); const frameRef = useRef<HTMLDivElement>(null);
  const kind: PanelKind = panel?.wide ? 'wide' : 'narrow'; const savedWidth = usePanelWidth(kind);
  const sideBySide = useMediaQuery('(min-width: 1024px)');
  // Mounted toggles, newest last: focus returns to the page's own toggle even while the frame's fallback unmounts.
  const toggles = useRef<HTMLButtonElement[]>([]);
  const registerToggle = useCallback((node: HTMLButtonElement | null) => { if (!node) return undefined; toggles.current = [...toggles.current, node]; return () => { toggles.current = toggles.current.filter(item => item !== node); }; }, []);
  const id = useId();
  const open = panel ? (wide ? (filters ? filtersOpen : !collapsed) : inline || overlayOpen) : false;
  // The Show button only exists while the panel is closed, so focus moves to it after the render that closes the panel.
  const focusToggle = useRef(false);
  useEffect(() => { if (!open && focusToggle.current) { focusToggle.current = false; toggles.current.at(-1)?.focus(); } }, [open]);
  // An overlay opened on a small screen does not carry over to the desktop column (or back).
  const [layoutWide, setLayoutWide] = useState(wide);
  if (layoutWide !== wide) { setLayoutWide(wide); setOverlayOpen(false); }
  const toggle = useCallback((next: boolean) => { if (!wide) setOverlayOpen(next); else if (filters) setFiltersOpen(next); else setPanelCollapsed(!next); }, [wide, filters]);
  useEffect(() => {
    if (!panel) return;
    function key(event: KeyboardEvent) {
      if (event.key !== '\\' || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      event.preventDefault();
      if (wide) toggle(!open); else if (!inline) setOverlayOpen(value => !value);
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [panel, wide, open, inline, toggle]);
  const name = panel?.label ?? panel?.title;
  // A page that places <PanelToggle /> itself (a toolbar, the stage bar) claims it; otherwise the frame shows it.
  const [claims, setClaims] = useState(0);
  const claim = useCallback(() => { setClaims(value => value + 1); return () => setClaims(value => value - 1); }, []);
  const count = panel?.filters?.count ?? 0;
  const control = useMemo<PanelControlValue | null>(() => panel ? { open, filters, count, id, name: name ?? 'panel', toggle, claim, registerToggle } : null, [panel, open, filters, count, id, name, toggle, claim, registerToggle]);
  // A remembered width applies wherever the panel sits beside the page; it never squeezes the page below its minimum.
  const resizable = !!panel && open && sideBySide && (wide || inline);
  const style = resizable && savedWidth !== null ? { [widthVar(kind)]: `clamp(${MIN_PANEL}px, ${Math.round(savedWidth)}px, calc(100vw - var(--rail-width) - ${MIN_MAIN}px))` } as CSSProperties : undefined;
  return <PanelControl.Provider value={control}><div ref={frameRef} style={style} className={`page-frame${className ? ` ${className}` : ''}`} data-panel={panel ? (open ? 'open' : 'closed') : 'none'} data-right={right ? 'open' : undefined} data-inline={inline ? '' : undefined}>
    {panel && <>
      {!wide && overlayOpen && <><div className="panel-scrim" aria-hidden="true" onClick={() => { focusToggle.current = true; setOverlayOpen(false); }} /><Trap target={panelRef} onClose={() => { focusToggle.current = true; setOverlayOpen(false); }} /></>}
      <aside ref={panelRef} id={id} className={`config-panel${panel.wide ? ' config-panel-wide' : ''}`} aria-label={name} tabIndex={-1} hidden={!open} data-overlay={!wide && !inline ? '' : undefined} data-resizable={resizable ? '' : undefined} data-filters={filters ? '' : undefined}>
        <header className="config-panel-head">
          <div><h2>{panel.title}</h2>{panel.subtitle && <p>{panel.subtitle}</p>}</div>
          {panel.actions}
          {(wide || !inline) && <button type="button" className="icon-button icon-button-small" aria-label={`Hide ${name}`} aria-controls={id} aria-expanded={open} onClick={() => { focusToggle.current = true; toggle(false); }}><Icon name={wide && !filters ? 'chevron-left' : 'close'} /></button>}
        </header>
        <div className="config-panel-body">{panel.body}</div>
        {panel.footer && <footer className="config-panel-foot">{panel.footer}</footer>}
        {resizable && <PanelResizer kind={kind} label={name ?? 'panel'} panel={panelRef} frame={frameRef} />}
      </aside>
    </>}
    <div className="page-frame-main">
      {panel && claims === 0 && (filters || !open) && <div className="panel-toggle-row"><PanelToggle fallback /></div>}
      {children}
    </div>
    {right}
  </div></PanelControl.Provider>;
}

/** Contextual details beside the page (≥1280), or a drawer over it on smaller screens. */
export function RightPanel({ title, subtitle, onClose, footer, children, closeLabel, label, className }: { title: ReactNode; subtitle?: ReactNode; onClose?: () => void; footer?: ReactNode; children: ReactNode; closeLabel?: string; label?: string; className?: string }) {
  const headingId = useId();
  return <aside className={`right-panel${className ? ` ${className}` : ''}`} aria-labelledby={label ? undefined : headingId} aria-label={label}>
    <header className="config-panel-head"><div><h2 id={headingId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{onClose && <button type="button" className="icon-button icon-button-small" aria-label={closeLabel ?? 'Close details'} onClick={onClose}><Icon name="close" /></button>}</header>
    <div className="config-panel-body">{children}</div>
    {footer && <footer className="config-panel-foot">{footer}</footer>}
  </aside>;
}
