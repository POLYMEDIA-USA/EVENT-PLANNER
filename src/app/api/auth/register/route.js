export const dynamic = 'force-dynamic';

import { getUsers, saveUsers, getOrganizations, saveOrganizations } from '@/lib/gcs';
import { issueSession } from '@/lib/auth';
import { verifyCredentials, VerifyAiUnavailableError } from '@/lib/verifyai';
import { v4 as uuidv4 } from 'uuid';

// VerifyAi-gated self-service registration (Dave's decision, relayed by the
// Access Portal session 2026-09-10 — see docs/claude/MESSAGE_FROM_ACCESS-PORTAL.md).
//
// The UX stays exactly as friction-free as before, which is the point: reps
// sign themselves up on a phone, standing at a live event. What changed is
// that the submitted email+password must be real VerifyAi dashboard
// credentials before an account is created — previously anyone could invent an
// identity and an org name here. The password is used once as a yes/no check
// against VerifyAi's auth-api and never hashed, stored, or logged.
export async function POST(request) {
  try {
    const { full_name, email, phone, password, organization_name } = await request.json();

    if (!full_name || !email || !password || !organization_name) {
      return Response.json({ error: 'Name, email, password, and organization are required' }, { status: 400 });
    }

    const users = await getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return Response.json({ error: 'Email already registered — sign in instead' }, { status: 409 });
    }

    // Credential check BEFORE any write, so a failed registration leaves no
    // half-created org or user behind.
    let ok;
    try {
      ok = await verifyCredentials(email, password);
    } catch (err) {
      if (err instanceof VerifyAiUnavailableError) {
        console.error('VerifyAi auth-api unavailable:', err.message);
        return Response.json(
          { error: 'VerifyAi sign-in service is unavailable. Please try again shortly.' },
          { status: 503 }
        );
      }
      throw err;
    }

    if (!ok) {
      return Response.json(
        { error: 'Those VerifyAi credentials were not accepted. Use the email and password from your VerifyAi dashboard.' },
        { status: 401 }
      );
    }

    // Find or create organization
    let organizations = await getOrganizations();
    let org = organizations.find(o => o.name.toLowerCase() === organization_name.toLowerCase());
    if (!org) {
      org = {
        id: uuidv4(),
        name: organization_name,
        created_at: new Date().toISOString(),
      };
      organizations.push(org);
      await saveOrganizations(organizations);
    }

    const user = {
      id: uuidv4(),
      email: email.toLowerCase(),
      full_name,
      phone: phone || '',
      auth_source: 'verifyai',
      verifyai_email: email.toLowerCase(),
      organization_id: org.id,
      organization_name: org.name,
      role: 'sales_rep',
      created_at: new Date().toISOString(),
    };

    const token = issueSession(user);
    users.push(user);
    await saveUsers(users);

    const { password_hash, ...safeUser } = user;
    return Response.json({ user: safeUser, token });
  } catch (err) {
    console.error('Register error:', err);
    return Response.json({ error: 'Registration failed' }, { status: 500 });
  }
}
