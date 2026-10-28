'use client';
import { useState } from 'react';
import { api, errorMessage, mutation } from './api';
import { ErrorNotice } from './Feedback';
import type { LogoProbeReport } from '../lib/central-logo-probe';

export function CentralLogoProbeForm() {
  const [workspaceId, setWorkspaceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<LogoProbeReport | null>(null);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setReport(null);
    try { setReport((await api<LogoProbeReport>('/api/dev/central-logo-probe', mutation('POST', { workspace_id: workspaceId }))).data); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <section className="editor-section"><form className="business-sign-in-form" onSubmit={submit}>
    <div className="field"><label htmlFor="probe-workspace">Dummy Test workspace ID</label><input id="probe-workspace" required maxLength={36} value={workspaceId} disabled={busy}
      pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" onChange={event => setWorkspaceId(event.target.value)} /></div>
    <button className="button" disabled={busy}>{busy ? 'Running storage checks…' : 'Run development storage checks'}</button>
  </form>{busy && <p role="status">Keep this page open while the bounded checks finish.</p>}{error && <ErrorNotice message={error} />}
    {report && <><p role="status">Storage check {report.result}.</p><label className="field" htmlFor="probe-report">Sanitized report<textarea id="probe-report" rows={25} readOnly value={JSON.stringify(report, null, 2)} /></label></>}
  </section>;
}
