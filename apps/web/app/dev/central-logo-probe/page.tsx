import { notFound } from 'next/navigation';
import { requireCentralLogoProbe } from '../../../lib/central-logo-probe';
import { CentralLogoProbeForm } from '../../../components/CentralLogoProbeForm';

export const dynamic = 'force-dynamic';
export default function CentralLogoProbePage() {
  try { requireCentralLogoProbe(); } catch { notFound(); }
  return <main className="main-content"><h1>Development logo storage check</h1>
    <p>Runs on the authorized Dummy Test workspace. Creates a new private, unselected Everyone logo asset and a cancelled reservation.</p>
    <p>Checks signing restrictions, real image verification and attempts to replace, move or remove only that new disposable asset. Shared branding and existing assets are untouched.</p>
    <CentralLogoProbeForm />
  </main>;
}
