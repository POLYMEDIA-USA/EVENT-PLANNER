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

    // Generate new session token
    const token = generateToken();
    user.session_token = token;
    await saveUsers(users);

    const { password_hash, ...safeUser } = user;
    return Response.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}
