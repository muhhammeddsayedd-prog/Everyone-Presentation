'use client';

import { createContext, createElement, useCallback, useContext, type ReactNode } from 'react';
import { useUnsavedChanges } from '../../ui/UnsavedChanges';

/** The scene breakdown asks before it leaves unsaved scene edits (switching scenes, switching Standard view / Scene
 * breakdown). The integrator provides the shared "Save your changes? — Save and continue · Discard changes · Keep editing"
 * dialog here; `confirmLeave` resolves true when leaving may proceed (saved or discarded) and false to keep editing. */
export interface UnsavedChangesAdapter { confirmLeave(): Promise<boolean> }

/** Without an explicit adapter, leaving defers to the shared registry (ui/UnsavedChanges): every registered dirty
 * editor is offered "Save and continue · Discard changes · Keep editing". */
export const defaultUnsavedChangesAdapter: UnsavedChangesAdapter = { confirmLeave: async () => true };

const Context = createContext<UnsavedChangesAdapter | null>(null);
export function UnsavedChangesAdapterProvider({ adapter, children }: { adapter: UnsavedChangesAdapter; children: ReactNode }) {
  return createElement(Context.Provider, { value: adapter }, children);
}
export function useUnsavedChangesAdapter(): UnsavedChangesAdapter {
  const explicit = useContext(Context); const shared = useUnsavedChanges();
  return explicit ?? { confirmLeave: () => shared.confirmLeave() };
}

/** Runs `action` only when no registered editor is dirty or the shared dialog allows leaving (saved or discarded).
 * The `dirty` hint is kept for callers; registered editors decide. Never changes project content itself. */
export function useLeaveGuard(dirty: boolean) {
  const adapter = useUnsavedChangesAdapter();
  return useCallback(async (action: () => void) => {
    void dirty;
    if (!(await adapter.confirmLeave())) return false;
    action(); return true;
  }, [adapter, dirty]);
}
