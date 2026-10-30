import { GrantMediaView } from '../../../../../../../components/GrantMediaView';

export const dynamic = 'force-dynamic';
export default async function MediaPage({ params }: { params: Promise<{ grant: string; versionId: string; assetId: string }> }) {
  return <GrantMediaView {...await params} />;
}
