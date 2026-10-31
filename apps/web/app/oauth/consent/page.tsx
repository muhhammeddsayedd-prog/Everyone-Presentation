import { OAuthConsent } from '../../../components/OAuthConsent';
import { parseOAuthConsentQuery } from '../../../lib/oauth-consent-contract';

export const dynamic = 'force-dynamic';
export default async function OAuthConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <OAuthConsent {...parseOAuthConsentQuery(await searchParams)} />;
}
