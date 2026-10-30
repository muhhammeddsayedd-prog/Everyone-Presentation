import { OAuthConsent } from '../../../components/OAuthConsent';
import { OAUTH_UUID } from '../../../lib/oauth-consent-contract';

export const dynamic = 'force-dynamic';
export default async function OAuthConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const valid = Object.keys(query).every(key => ['authorization_id', 'auth'].includes(key))
    && typeof query.authorization_id === 'string' && OAUTH_UUID.test(query.authorization_id)
    && (query.auth === undefined || query.auth === 'failed');
  return <OAuthConsent authorizationId={valid ? query.authorization_id as string : null} callbackFailed={query.auth === 'failed'} />;
}
