export const dynamic = 'force-dynamic';

import { getUsers, saveUsers } from '@/lib/gcs';
import { verifyPassword, issueSession, isVerifyAiUser } from '@/lib/auth';
import { verifyCredentials, VerifyAiUnavailableError } from '@/lib/verifyai';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const users = await getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Two kinds of account: `local` (default — a password_hash in users.json)
    // and `verifyai` (no local password; VerifyAi's auth-api is asked yes/no).
    // Everything after this check is identical for both.
    let ok;
    if (isVerifyAiUser(user)) {
      const verifyaiEmail = user.verifyai_email || user.email;
      try {
        ok = await verifyCredentials(verifyaiEmail, password);
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
    } else {
      ok = !!user.password_hash && verifyPassword(password, user.password_hash);
    }

    if (!ok) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = issueSession(user);
    await saveUsers(users);

    const { password_hash, ...safeUser } = user;
    return Response.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}
