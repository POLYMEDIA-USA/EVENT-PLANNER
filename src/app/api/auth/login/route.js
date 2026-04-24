export const dynamic = 'force-dynamic';

import { getUsers, saveUsers } from '@/lib/gcs';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const users = await getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user || !verifyPassword(password, user.password_hash)) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Generate new session token. Append to session_tokens array so prior
    // logins (other device, other browser) stay valid. Cap the array at 20
    // entries per user — FIFO eviction — so an endlessly-reused account
    // can't balloon the user record forever.
    const token = generateToken();
    user.session_token = token; // keep legacy field populated for backward compat
    if (!Array.isArray(user.session_tokens)) user.session_tokens = [];
    user.session_tokens.push(token);
    if (user.session_tokens.length > 20) {
      user.session_tokens = user.session_tokens.slice(-20);
    }
    await saveUsers(users);

    const { password_hash, ...safeUser } = user;
    return Response.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}
