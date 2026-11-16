'use client';

import { createContext, createElement, useCallback, useContext, type ReactNode } from 'react';

/** The scene breakdown asks before it leaves unsaved scene edits (switching scenes, switching Standard view / Scene
 * breakdown). The integrator provides the shared "Save your changes? — Save and continue · Discard changes · Keep editing"
 * dialog here; `confirmLeave` resolves true when leaving may proceed (saved or discarded) and false to keep editing. */
export interface UnsavedChangesAdapter { confirmLeave(): Promise<boolean> }

/** Default until the shared dialog is wired: leaving is always allowed (the scene editors save on explicit actions only). */
export const defaultUnsavedChangesAdapter: UnsavedChangesAdapter = { confirmLeave: async () => true };

const Context = createContext<UnsavedChangesAdapter>(defaultUnsavedChangesAdapter);
export function UnsavedChangesAdapterProvider({ adapter, children }: { adapter: UnsavedChangesAdapter; children: ReactNode }) {
  return createElement(Context.Provider, { value: adapter }, children);
}
export function useUnsavedChangesAdapter(): UnsavedChangesAdapter { return useContext(Context); }

/** Runs `action` only when nothing is dirty or the adapter allows leaving. Never changes project content itself. */
export function useLeaveGuard(dirty: boolean) {
  const adapter = useUnsavedChangesAdapter();
  return useCallback(async (action: () => void) => {
    if (dirty && !(await adapter.confirmLeave())) return false;
    action(); return true;
  }, [adapter, dirty]);
}
