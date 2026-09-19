export const dynamic = 'force-dynamic';

import { getUsers, saveUsers } from '@/lib/gcs';
import { issueSession } from '@/lib/auth';
import { getPortalIdentity, portalBaseUrl } from '@/lib/portal-session';

// Exchanges an Access Portal `verifyai_session` cookie for an ordinary local
// FunnelFlow bearer token, so the rest of the app's auth is untouched.
//
// Every non-200 here is a normal outcome, not an error: the client falls
// through to our own login/registration page. We are the partial case in the
// fleet SSO contract on purpose — nobody gets redirected to Portal, because
// reps signing up at a live event have no Portal account at all (see
// src/lib/portal-session.js for the full rationale).
//
// `reason` lets the login page say something useful instead of silently
// showing an empty form to someone who IS signed in fleet-wide:
//   no_cookie        — not a Portal user, or Portal session expired
//   no_local_account — valid Portal identity, but no FunnelFlow user yet
export async function POST(request) {
  try {
    const identity = await getPortalIdentity(request);
    if (!identity) {
      return Response.json({ error: 'No Portal session', reason: 'no_cookie' }, { status: 401 });
    }

    const email = String(identity.email).toLowerCase();
    const users = await getUsers();
    // Match the Portal identity to a local account. An exact account-email match
    // wins; otherwise fall back to verifyai_email, the explicit "this FunnelFlow
    // account belongs to that VerifyAi identity" link. People whose FunnelFlow
    // account was created under one address (@parametrik.net) but who sign in to
    // VerifyAi under another (@verifyai.net) are only reachable via that link —
    // without it their Portal cookie looks like a stranger's.
    const user = users.find(u => u.email.toLowerCase() === email)
      || users.find(u => (u.verifyai_email || '').toLowerCase() === email);

    // Portal's cookie proves identity, not authorization — deliberately no
    // auto-provisioning. An unknown Portal user lands on our registration
    // form like anyone else.
    if (!user || user.disabled) {
      return Response.json(
        { error: 'No FunnelFlow account for this VerifyAi identity', reason: 'no_local_account', portal_email: email },
        { status: 401 }
      );
    }

    const token = issueSession(user);
    await saveUsers(users);

    const { password_hash, ...safeUser } = user;
    // portal_url lets the client build the fleet-wide logout link without
    // importing this module (and jose with it) into the browser bundle.
    return Response.json({ user: safeUser, token, sso: true, portal_url: portalBaseUrl() });
  } catch (err) {
    console.error('Portal session exchange error:', err);
    return Response.json({ error: 'Portal sign-in failed', reason: 'error' }, { status: 500 });
  }
}
