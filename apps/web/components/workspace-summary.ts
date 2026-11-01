'use client';

import { useEffect, useState } from 'react';
import { parseWorkspaceSummary, type WorkspaceSummary } from '../../../packages/domain/src/workspace-summary.ts';
import { api } from './api';

export type { WorkspaceSummary };

/**
 * Whole-workspace counts from GET /workspaces/{id}/summary (docs: frontend dependency 1).
 * `null` means unknown: not loaded, unavailable (fixture mode, older server, failure) or
 * withheld by permission. Unknown is never shown as zero, and no count is derived from a
 * loaded page. The summary is reloaded whenever the workspace revision moves.
 */
export function useWorkspaceSummary(workspaceId: string, enabled: boolean, revision: string): WorkspaceSummary | null {
  const [state, setState] = useState<{ key: string; summary: WorkspaceSummary | null }>({ key: '', summary: null });
  const key = `${workspaceId}:${revision}`;
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    api<unknown>(`/api/v1/workspaces/${workspaceId}/summary`)
      .then(result => { if (current) setState({ key, summary: parseWorkspaceSummary(result.data, workspaceId) }); })
      // A missing summary leaves counts unknown; the workspace itself still works.
      .catch(() => { if (current) setState({ key, summary: null }); });
    return () => { current = false; };
  }, [workspaceId, enabled, key]);
  // Keep the previous counts visible while a newer revision is loading, but only for this workspace.
  return enabled && state.key.startsWith(`${workspaceId}:`) ? state.summary : null;
}

export function plural(count: number, one: string, many: string): string { return `${count} ${count === 1 ? one : many}`; }

/** Short status beside each workspace step. Undefined when the count is unknown or there is nothing to say. */
export function stepStatus(summary: WorkspaceSummary | null, step: string, output: 'selection' | 'shortlist'): { text: string; tone: 'warn' | 'muted' | 'ok' } | undefined {
  if (!summary) return undefined;
  if (step === 'specs') return summary.roles_needing_clarification ? { text: `${summary.roles_needing_clarification} to clarify`, tone: 'warn' } : undefined;
  if (step === 'cast') return { text: `${summary.project_candidate_count} in project`, tone: 'muted' };
  if (step === 'organize') return summary.open_slot_count ? { text: plural(summary.open_slot_count, 'open slot', 'open slots'), tone: 'warn' } : undefined;
  if (step === 'presentations') {
    const ready = summary.latest_ready_versions.filter(item => item.output_type === output);
    if (ready.length === 1) return { text: `v${ready[0].version_no} ready`, tone: 'ok' };
    if (ready.length > 1) return { text: `${ready.length} series ready`, tone: 'ok' };
  }
  return undefined;
}
