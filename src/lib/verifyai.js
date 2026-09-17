// VerifyAi's auth-api is used purely as a credential oracle: FunnelFlow never
// stores, forwards, or verifies a VerifyAi-issued JWT (those are HS256 with a
// shared secret and no JWKS anywhere in the stack — handing that secret to
// every app that wants to check a VerifyAi login would be a real blast-radius
// mistake). verifyCredentials() posts the submitted email+password straight
// through and discards the response body immediately; our own local session
// system (bearer tokens in session_tokens[]) does everything else, unchanged.
//
// Contract received from the Access Portal session, 2026-09-10 — see
// docs/claude/MESSAGE_FROM_ACCESS-PORTAL.md.

const LOGIN_TIMEOUT_MS = 5000;

const DEFAULT_AUTH_API_URL =
  'https://verifyai-auth-api-production-143845647654.us-central1.run.app';

// Thrown only for network/5xx failures — distinct from "wrong password" so
// callers can tell a user "sign-in service unavailable" instead of the
// misleading "invalid email or password."
export class VerifyAiUnavailableError extends Error {}

export function authApiUrl() {
  return process.env.VERIFYAI_AUTH_API_URL || DEFAULT_AUTH_API_URL;
}

export async function verifyCredentials(email, password) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${authApiUrl()}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new VerifyAiUnavailableError(err.message);
  } finally {
    clearTimeout(timeout);
  }

  if (res.ok) return true;
  if (res.status >= 500) throw new VerifyAiUnavailableError(`VerifyAi auth-api returned ${res.status}`);
  return false;
}
