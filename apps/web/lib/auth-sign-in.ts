import { DomainError } from '@eps/domain';

export interface SignInLinkRequest {
  email: string;
  options: { emailRedirectTo: string; shouldCreateUser: true };
}
type RequestLink = (input: SignInLinkRequest) => Promise<{ error: unknown }>;

/** Map documented Auth codes, never provider message/body text, into public errors. */
export function mapSignInError(error: unknown): DomainError {
  const provider = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown } : {};
  switch (provider.code) {
    case 'over_email_send_rate_limit':
      // Auth uses this for both per-user resend frequency and email sending limits.
      // Neither the code nor HTTP 429 establishes a precise reset time.
      return new DomainError('AUTH_EMAIL_RATE_LIMITED',
        'Sign-in email sending is temporarily limited. Check your inbox for a recent link, or try again later. If this continues, ask your workspace administrator to check the email service’s sending limits.',
        429, {}, true);
    case 'over_request_rate_limit':
      return new DomainError('AUTH_REQUEST_RATE_LIMITED',
        'The sign-in service is receiving too many requests. Try again later.', 429, {}, true);
    case 'email_address_not_authorized':
      return new DomainError('AUTH_EMAIL_CONFIGURATION_REQUIRED',
        'The configured email service cannot send a sign-in link to this address. Ask your workspace administrator to check email delivery.', 503);
    case 'email_provider_disabled':
    case 'otp_disabled':
    case 'signup_disabled':
      return new DomainError('AUTH_EMAIL_CONFIGURATION_REQUIRED',
        'A sign-in link could not be requested with the current workspace Auth configuration. Ask your workspace administrator to check email sign-in and account enrollment.', 503);
    case 'email_address_invalid':
      return new DomainError('VALIDATION_FAILED', 'Use an email address supported by the email service.', 400);
    default:
      if (provider.status === 429) return new DomainError('RATE_LIMITED',
        'Sign-in requests are temporarily limited. Try again later.', 429, {}, true);
      // unexpected_failure also covers non-SMTP failures; do not invent a diagnosis.
      return new DomainError('DEPENDENCY_UNAVAILABLE',
        'The sign-in email service is temporarily unavailable. Try again later or ask your workspace administrator to check email delivery.', 503, {}, true);
  }
}

/** One explicit request only. Provider throttling must never trigger automatic resend. */
export async function requestBusinessSignIn(input: unknown, baseUrl: string, requestLink: RequestLink): Promise<{ requested: true }> {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1
    || !('email' in input) || typeof input.email !== 'string') {
    throw new DomainError('VALIDATION_FAILED', 'Enter a valid email address.', 400);
  }
  const email = input.email.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DomainError('VALIDATION_FAILED', 'Enter a valid email address.', 400);
  }
  let result: { error: unknown };
  try {
    result = await requestLink({ email, options: {
      emailRedirectTo: `${baseUrl}/api/auth/callback`, shouldCreateUser: true
    } });
  } catch (error) { throw mapSignInError(error); }
  if (result.error) throw mapSignInError(result.error);
  return { requested: true };
}
