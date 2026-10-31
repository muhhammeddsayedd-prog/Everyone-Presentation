'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ConfirmModal } from './Overlay';

export type ConfirmRequest = { title: string; description?: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; details?: ReactNode };
type Pending = ConfirmRequest & { resolve: (accepted: boolean) => void };
const ConfirmContext = createContext<(request: ConfirmRequest) => Promise<boolean>>(async () => false);

/** Replaces window.confirm with an accessible alert dialog that names the exact consequence. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const current = useRef<Pending | null>(null);
  const confirm = useCallback((request: ConfirmRequest) => new Promise<boolean>(resolve => {
    current.current?.resolve(false);
    const next = { ...request, resolve };
    current.current = next; setPending(next);
  }), []);
  function settle(accepted: boolean) { const active = current.current; current.current = null; setPending(null); active?.resolve(accepted); }
  return <ConfirmContext.Provider value={confirm}>{children}
    {pending && <ConfirmModal title={pending.title} description={pending.description} confirmLabel={pending.confirmLabel} cancelLabel={pending.cancelLabel} danger={pending.danger} onConfirm={() => settle(true)} onCancel={() => settle(false)}>{pending.details}</ConfirmModal>}
  </ConfirmContext.Provider>;
}

export function useConfirm() { return useContext(ConfirmContext); }
