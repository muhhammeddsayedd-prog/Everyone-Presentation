import { GrantMediaView } from '../../../components/GrantMediaView';

export const dynamic = 'force-dynamic';
export default async function MediaResumePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <GrantMediaView versionId={typeof query.version === 'string' ? query.version : ''} assetId={typeof query.asset === 'string' ? query.asset : ''} />;
}
