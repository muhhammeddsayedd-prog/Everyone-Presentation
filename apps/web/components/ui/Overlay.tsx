'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';

const focusable = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open overlays, innermost last. Only the top one answers Escape and Tab, so a confirm dialog
// over a drawer closes alone.
const trapStack: HTMLElement[] = [];

/** Keeps Tab inside the container, closes on Escape and returns focus to the opener on unmount.
 * Keys are handled at document level so a control disabled mid-write (focus falls to body) cannot strand the user. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, onEscape?: () => void, initialFocus?: RefObject<HTMLElement | null>) {
  const escape = useRef(onEscape);
  useEffect(() => { escape.current = onEscape; });
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const container = ref.current;
    if (!container) return;
    trapStack.push(container);
    const first = initialFocus?.current ?? container.querySelector<HTMLElement>('[data-autofocus]') ?? container;
    first.focus();
    function keydown(event: KeyboardEvent) {
      if (!container || trapStack[trapStack.length - 1] !== container || event.defaultPrevented) return;
      const inside = container.contains(document.activeElement);
      if (!inside && document.activeElement !== document.body) return;
      if (event.key === 'Escape' && escape.current) { event.preventDefault(); escape.current(); return; }
      if (event.key !== 'Tab') return;
      const items = [...container.querySelectorAll<HTMLElement>(focusable)].filter(item => item.offsetParent !== null || item === document.activeElement);
      if (!items.length) { event.preventDefault(); container.focus(); return; }
      const start = items[0]; const end = items[items.length - 1];
      if (!inside) { event.preventDefault(); (event.shiftKey ? end : start).focus(); }
      else if (event.shiftKey && (document.activeElement === start || document.activeElement === container)) { event.preventDefault(); end.focus(); }
      else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); start.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      const index = trapStack.lastIndexOf(container); if (index >= 0) trapStack.splice(index, 1);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [ref, initialFocus]);
}

function usePortal() { return typeof document === 'undefined' ? null : document.body; }

interface OverlayProps { title: string; description?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; closeLabel?: string; busy?: boolean; initialFocus?: RefObject<HTMLElement | null> }

/** Side drawer for inspecting or editing one object without leaving the list or board.
 * `inline` keeps it in its owner's DOM (still fixed to the viewport edge). */
export function Drawer({ title, description, onClose, children, footer, wide, closeLabel = 'Close', busy, initialFocus, inline }: OverlayProps & { wide?: boolean; inline?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId(); const descriptionId = useId();
  useFocusTrap(ref, busy ? undefined : onClose, initialFocus);
  const target = usePortal();
  if (!target) return null;
  const layer = <><div className="scrim" onClick={busy ? undefined : onClose} aria-hidden="true" />
    <div ref={ref} className={`drawer${wide ? ' drawer-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1} aria-busy={busy || undefined}>
      <header className="drawer-header"><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label={closeLabel}><Icon name="close" /></button></header>
      <div className="drawer-body">{children}</div>
      {footer && <footer className="drawer-footer">{footer}</footer>}
    </div></>;
  return inline ? layer : createPortal(layer, target);
}

/** Centred modal, reserved for consequences or a decision between two things.
 * `inline` keeps the dialog in place in the DOM (still fixed and centred) so it stays scoped to its owner. */
export function Modal({ title, description, onClose, children, footer, wide, busy, initialFocus, role = 'dialog', inline }: OverlayProps & { wide?: boolean; role?: 'dialog' | 'alertdialog'; inline?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId(); const descriptionId = useId();
  useFocusTrap(ref, busy ? undefined : onClose, initialFocus);
  const target = usePortal();
  if (!target) return null;
  const layer = <div className="modal-layer" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} className={`modal${wide ? ' modal-wide' : ''}`} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1} aria-busy={busy || undefined}>
      <header className="modal-header"><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</header>
      <div className="modal-body">{children}</div>
      {footer && <footer className="modal-footer">{footer}</footer>}
    </div></div>;
  return inline ? layer : createPortal(layer, target);
}

/** Consequence confirmation replacing window.confirm. The confirm label names the exact action. */
export function ConfirmModal({ title, description, confirmLabel, cancelLabel = 'Cancel', danger, busy, onConfirm, onCancel, children }: { title: string; description?: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void; children?: ReactNode }) {
  const cancel = useRef<HTMLButtonElement>(null);
  return <Modal role="alertdialog" title={title} description={description} onClose={onCancel} busy={busy} initialFocus={cancel}
    footer={<><button ref={cancel} type="button" className="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button><button type="button" className={`button ${danger ? 'button-danger' : 'button-primary'}`} onClick={onConfirm} disabled={busy}>{confirmLabel}</button></>}>
    {children}
  </Modal>;
}
