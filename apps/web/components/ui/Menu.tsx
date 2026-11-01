'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';

export type MenuItem =
  | { kind?: 'action'; label: string; onSelect: () => void; disabled?: boolean; danger?: boolean; checked?: boolean; description?: string }
  | { kind: 'separator' }
  | { kind: 'label'; label: string };

/** Per-item action menu (menu button pattern): arrow keys move, Enter/Space select, Escape closes and refocuses the trigger. */
export function ActionMenu({ label, items, trigger, disabled, align = 'end' }: { label: string; items: MenuItem[]; trigger?: ReactNode; disabled?: boolean; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const entries = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? [])];
  useEffect(() => {
    if (!open) return;
    entries()[0]?.focus();
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
    <button ref={button} type="button" className={trigger ? 'button button-small' : 'icon-button icon-button-small'} aria-label={trigger ? undefined : label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled}
      onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true); } }}>
      {trigger ?? <Icon name="more" />}
    </button>
    {open && <div ref={menu} id={id} className="menu" role="menu" aria-label={label} onKeyDown={keydown} style={align === 'start' ? { left: 0, right: 'auto' } : undefined}>
      {items.map((item, index) => item.kind === 'separator' ? <hr key={index} /> : item.kind === 'label' ? <div key={index} className="menu-label" role="presentation">{item.label}</div>
        : <button key={index} type="button" tabIndex={-1} role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} className={item.danger ? 'menu-danger' : undefined} disabled={item.disabled}
          onClick={() => { close(); item.onSelect(); }}>{item.label}</button>)}
    </div>}
  </span>;
}
