'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Overlay';
import { errorMessage } from '../api';

/** One open editor. `save` must resolve only after the server confirmed the change and throw (keeping
 * the editor's input intact) on validation, network or uncertain failure. */
export interface UnsavedEditor { scope: string; label: string; isDirty: () => boolean; save?: () => Promise<void>; discard?: () => void }
type Pending = { scope?: string; resolve: (proceed: boolean) => void; error: string; saving: boolean; labels: string[]; canSave: boolean };
interface Registry {
  register(id: string, editor: UnsavedEditor): () => void;
  dirty(scope?: string): UnsavedEditor[];
  confirmLeave(options?: { scope?: string }): Promise<boolean>;
}
const fallback: Registry = { register: () => () => undefined, dirty: () => [], confirmLeave: async () => true };
const Context = createContext<Registry>(fallback);
const inScope = (editor: UnsavedEditor, scope?: string) => !scope || editor.scope === scope || editor.scope.startsWith(`${scope}:`);

/** Registry of open editors and the one "Save your changes?" dialog used before anything leaves them:
 * drawer close (button, Escape, backdrop), cancel, tab and scene changes and in-app navigation. */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const editors = useRef(new Map<string, UnsavedEditor>());
  const [pending, setPending] = useState<Pending | null>(null);
  const current = useRef<Pending | null>(null);
  const dirty = useCallback((scope?: string) => [...editors.current.values()].filter(editor => inScope(editor, scope) && editor.isDirty()), []);
  const register = useCallback((id: string, editor: UnsavedEditor) => { editors.current.set(id, editor); return () => { if (editors.current.get(id) === editor) editors.current.delete(id); }; }, []);
  const confirmLeave = useCallback((options: { scope?: string } = {}) => new Promise<boolean>(resolve => {
    if (!dirty(options.scope).length) { resolve(true); return; }
    current.current?.resolve(false);
    const open = dirty(options.scope);
    const next: Pending = { scope: options.scope, resolve, error: '', saving: false, labels: open.map(editor => editor.label), canSave: open.every(editor => editor.save) };
    current.current = next; setPending(next);
  }), [dirty]);
  function settle(proceed: boolean) { const active = current.current; current.current = null; setPending(null); active?.resolve(proceed); }
  function update(patch: Partial<Pending>) { const active = current.current; if (!active) return; const next = { ...active, ...patch }; current.current = next; setPending(next); }
  async function saveAll() {
    const open = current.current; if (!open) return;
    update({ saving: true, error: '' });
    try {
      // Each save resolves only after the server confirmed it; the first failure stops here.
      for (const editor of dirty(open.scope)) await editor.save!();
      if (current.current === open || current.current?.resolve === open.resolve) settle(true);
    } catch (reason) { update({ saving: false, error: errorMessage(reason) }); }
  }
  function discardAll() {
    const open = current.current; if (!open) return;
    for (const editor of dirty(open.scope)) editor.discard?.();
    settle(true);
  }
  const value = useMemo(() => ({ register, dirty, confirmLeave }), [register, dirty, confirmLeave]);
  const canSave = Boolean(pending?.canSave);
  return <Context.Provider value={value}>{children}
    {pending && <Modal role="alertdialog" title="Save your changes?" busy={pending.saving} onClose={() => settle(false)}
      description={pending.labels.length ? <>Unsaved: {pending.labels.join(', ')}.</> : 'You have unsaved changes.'}
      footer={<><button type="button" className="button" data-autofocus onClick={() => settle(false)} disabled={pending.saving}>Keep editing</button>
        <button type="button" className="button button-danger-quiet" onClick={discardAll} disabled={pending.saving}>Discard changes</button>
        <button type="button" className="button button-primary" onClick={() => void saveAll()} disabled={pending.saving || !canSave}>{pending.saving ? 'Saving…' : 'Save and continue'}</button></>}>
      {!canSave && !pending.saving && <p className="small muted">Some of these changes can only be saved from their own screen. Keep editing to save them there, or discard them.</p>}
      {pending.error && <div className="notice notice-error" role="alert"><p>Your changes were not saved: {pending.error} Your input is kept.</p></div>}
    </Modal>}
  </Context.Provider>;
}

/** Ask before leaving open editors. Other screens call `confirmLeave({ scope })` before a scene
 * change, the Standard/Scene toggle or any other step that would close an editor. */
export function useUnsavedChanges() {
  const registry = useContext(Context);
  return { confirmLeave: registry.confirmLeave, hasUnsavedChanges: (scope?: string) => registry.dirty(scope).length > 0 };
}

/** Register an editor while it is mounted. The latest dirty flag and callbacks are always used. */
export function useUnsavedEditor(id: string, editor: { scope?: string; label: string; dirty: boolean; save?: () => Promise<void>; discard?: () => void }) {
  const registry = useContext(Context);
  const latest = useRef(editor);
  useEffect(() => { latest.current = editor; });
  const hasSave = Boolean(editor.save); const hasDiscard = Boolean(editor.discard);
  useEffect(() => registry.register(id, {
    get scope() { return latest.current.scope ?? id; }, get label() { return latest.current.label; },
    isDirty: () => latest.current.dirty,
    ...(hasSave ? { save: () => latest.current.save!() } : {}),
    ...(hasDiscard ? { discard: () => latest.current.discard!() } : {}),
  }), [registry, id, hasSave, hasDiscard]);
}
