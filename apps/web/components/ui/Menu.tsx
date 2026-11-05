'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../Icon';

export type MenuItem =
  | { kind?: 'action'; label: string; onSelect: () => void; disabled?: boolean; danger?: boolean; checked?: boolean; description?: string }
  | { kind: 'separator' }
  | { kind: 'label'; label: string };

/** Per-item action menu (menu button pattern): arrow keys move, Enter/Space select, Escape closes and refocuses the trigger. */
export function ActionMenu({ label, items, trigger, disabled, align = 'end', triggerClassName }: { label: string; items: MenuItem[]; trigger?: ReactNode; disabled?: boolean; align?: 'start' | 'end' | 'side'; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  // The open menu is fixed to the viewport next to its button, so a scrolling list, a sticky panel or the
  // sticky action bar never clips it. It opens upward when there is no room below and stays on screen.
  useLayoutEffect(() => {
    if (!open || !button.current || !menu.current) { setPlace(null); return; }
    const anchor = button.current.getBoundingClientRect(); const box = menu.current.getBoundingClientRect();
    const gap = 4; const edge = 8;
    const below = window.innerHeight - anchor.bottom - edge; const above = anchor.top - edge;
    if (align === 'side') {
      // Beside the trigger (the icon rail): to its right, aligned to its top and kept on screen.
      setPlace({ position: 'fixed', top: Math.max(edge, Math.min(anchor.top, window.innerHeight - edge - box.height)), left: anchor.right + 3 * gap, right: 'auto', maxHeight: `${window.innerHeight - 2 * edge}px`, overflowY: 'auto' });
      return;
    }
    const up = box.height + gap > below && above > below;
    const top = up ? Math.max(edge, anchor.top - gap - box.height) : Math.min(anchor.bottom + gap, window.innerHeight - edge - box.height);
    const left = align === 'start' ? anchor.left : anchor.right - box.width;
    setPlace({ position: 'fixed', top: Math.max(edge, top), left: Math.min(Math.max(edge, left), window.innerWidth - edge - box.width), right: 'auto', maxHeight: `${(up ? above : below) - gap}px`, overflowY: 'auto' });
  }, [open, align]);
  useEffect(() => {
    if (!open) return;
    // A fixed menu would drift from its button, so scrolling the page or a panel closes it (not scrolling inside it).
    function scroll(event: Event) { if (!menu.current?.contains(event.target as Node)) setOpen(false); }
    function resize() { setOpen(false); }
    window.addEventListener('scroll', scroll, true); window.addEventListener('resize', resize);
    return () => { window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', resize); };
  }, [open]);
  const entries = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? [])];
  // Focus the first item once the menu is placed (it is hidden for the one frame it takes to measure it).
  useEffect(() => { if (open && place) entries()[0]?.focus({ preventScroll: true }); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    function outside(event: MouseEvent) { if (!menu.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);
  function close(refocus = true) { setOpen(false); if (refocus) button.current?.focus(); }
  function keydown(event: React.KeyboardEvent) {
    const list = entries(); const index = list.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); list[(index + 1) % list.length]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); list[(index - 1 + list.length) % list.length]?.focus(); }
    else if (event.key === 'Home') { event.preventDefault(); list[0]?.focus(); }
    else if (event.key === 'End') { event.preventDefault(); list[list.length - 1]?.focus(); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'Tab') close(false);
  }
  return <span className="menu-anchor">
    <button ref={button} type="button" className={triggerClassName ?? (trigger ? 'button button-small' : 'icon-button icon-button-small')} aria-label={trigger && !triggerClassName ? undefined : label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled}
      onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true); } }}>
      {trigger ?? <Icon name="more" />}
    </button>
    {open && <div ref={menu} id={id} className="menu" role="menu" aria-label={label} onKeyDown={keydown} style={place ?? { visibility: 'hidden', ...(align === 'start' ? { left: 0, right: 'auto' } : {}) }}>
      {items.map((item, index) => item.kind === 'separator' ? <hr key={index} /> : item.kind === 'label' ? <div key={index} className="menu-label" role="presentation">{item.label}</div>
        : <button key={index} type="button" tabIndex={-1} role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} className={item.danger ? 'menu-danger' : undefined} disabled={item.disabled}
          onClick={() => { close(); item.onSelect(); }}>{item.label}</button>)}
    </div>}
  </span>;
}
