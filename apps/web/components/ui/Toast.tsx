'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { useExitMotion } from '../motion/motion';

export type ToastInput = { message: string; tone?: 'neutral' | 'error'; action?: { label: string; onSelect: () => void | Promise<void> }; timeout?: number };
type ToastEntry = ToastInput & { id: number };
const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

/** Results that can be reversed are confirmed with a toast; the region is a polite live region. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const next = useRef(0);
  const dismiss = useCallback((id: number) => setToasts(list => list.filter(item => item.id !== id)), []);
  const show = useCallback((toast: ToastInput) => { const id = ++next.current; setToasts(list => [...list.slice(-2), { ...toast, id }]); }, []);
  const value = useMemo(() => show, [show]);
  return <ToastContext.Provider value={value}>{children}
    <div className="toast-region" aria-live="polite" aria-relevant="additions text">{toasts.map(toast => <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />)}</div>
  </ToastContext.Provider>;
}

function Toast({ toast, onDismiss }: { toast: ToastEntry; onDismiss: () => void }) {
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useExitMotion([[ref, 'toast']]);
  useEffect(() => {
    if (hovered || busy) return;
    const timer = setTimeout(onDismiss, toast.timeout ?? (toast.action ? 10000 : 5000));
    return () => clearTimeout(timer);
  }, [hovered, busy, onDismiss, toast.timeout, toast.action]);
  return <div ref={ref} className={`toast${toast.tone === 'error' ? ' toast-error' : ''}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}>
    <p>{toast.message}</p>
    {toast.action && <button type="button" className="button button-small" disabled={busy} onClick={async () => { setBusy(true); try { await toast.action!.onSelect(); } finally { onDismiss(); } }}>{busy ? 'Working…' : toast.action.label}</button>}
    <button type="button" className="icon-button icon-button-small" aria-label="Dismiss notification" onClick={onDismiss}><Icon name="close" /></button>
  </div>;
}

export function useToast() { return useContext(ToastContext); }
