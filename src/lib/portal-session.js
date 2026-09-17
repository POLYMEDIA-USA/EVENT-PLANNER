// Fleet-wide single sign-on — consumer side.
//
// Access Portal (portal.verifyai.net) is the identity provider for every
// internal VerifyAi tool. A logged-in Portal user's browser carries a
// `verifyai_session` cookie scoped to Domain=verifyai.net: a short-lived
// (~30 min) Ed25519-signed JWT. Portal publishes only the PUBLIC key at
// /.well-known/jwks.json, so we verify tokens locally — createRemoteJWKSet
// fetches and caches the key, and there is no network call back to Portal on
// each verification.
//
// FunnelFlow is a DELIBERATE PARTIAL CASE of the fleet SSO contract (see
// docs/claude/MESSAGE_FROM_ACCESS-PORTAL.md, 2026-09-16). The other five
// siblings forcibly redirect an unauthenticated visitor to Portal's login.
// We do NOT: our whole point is serving reps who show up at a live event with
// no account anywhere yet, and Portal is admin-provisioned with no
// self-registration — a forced redirect would be a dead end for them. So the
// Portal cookie is an accelerator (use it if it's there and matches a local
// account) and our own login/registration page stays the primary path.
//
// The cookie is consumed in exactly one place — POST /api/auth/portal-session
// — which exchanges it for an ordinary local bearer token. Every other route's
// auth is unchanged (Authorization: Bearer + session_tokens[]), so there is no
// second auth path to keep in sync across 30+ route files.

import { createRemoteJWKSet, jwtVerify } from 'jose';

export const PORTAL_SESSION_COOKIE = 'verifyai_session';

const DEFAULT_PORTAL_URL = 'https://portal.verifyai.net';

export function portalBaseUrl() {
  return (process.env.PORTAL_BASE_URL || DEFAULT_PORTAL_URL).replace(/\/$/, '');
}

// Portal signs with `iss: https://portal.verifyai.net` regardless of how we
// reach it, so the issuer we require is fixed rather than derived from
// PORTAL_BASE_URL (which exists only to point at a staging Portal).
const ISSUER = DEFAULT_PORTAL_URL;

let jwksCache = null;
let jwksCacheKey = null;

function getJWKS() {
  const url = `${portalBaseUrl()}/.well-known/jwks.json`;
  if (!jwksCache || jwksCacheKey !== url) {
    jwksCache = createRemoteJWKSet(new URL(url));
    jwksCacheKey = url;
  }
  return jwksCache;
}

/**
 * Verifies a Portal session JWT.
 * Returns the payload ({sub, email, is_admin, iss, iat, exp}) or null for
 * anything missing/invalid/expired/wrong-issuer. Never throws — a Portal
 * outage or a rotated key must degrade to "no SSO", not to a 500 on our
 * own login page.
 */
export async function verifyPortalToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJWKS(), { issuer: ISSUER });
    return payload?.email ? payload : null;
  } catch {
    return null;
  }
}

/** Reads and verifies the Portal cookie off an incoming request. */
export async function getPortalIdentity(request) {
  const token = request.cookies?.get?.(PORTAL_SESSION_COOKIE)?.value;
  return verifyPortalToken(token);
}

/**
 * Fleet-wide logout URL. "Sign Out" must be a real navigation to this (not a
 * fetch) for anyone who arrived via a valid Portal cookie — clearing only our
 * own local state would leave them signed in everywhere else on the shared
 * verifyai.net cookie, and straight back in here on the next visit.
 */
export function portalLogoutUrl(returnTo) {
  const base = `${portalBaseUrl()}/logout`;
  return returnTo ? `${base}?return_to=${encodeURIComponent(returnTo)}` : base;
}
