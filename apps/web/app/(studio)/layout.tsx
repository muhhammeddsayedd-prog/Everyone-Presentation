import type { ReactNode } from 'react';
import { StudioApp } from '../../components/StudioApp';

/** The persistent Studio shell for every client-routed screen (projects, workspaces, library, presentations,
 * processing, settings). The matched page renders nothing; StudioApp routes on the pathname. */
export default function StudioLayout({ children }: { children: ReactNode }) {
  return <><StudioApp />{children}</>;
}
