export const dynamic = 'force-dynamic';

import { userMatchesToken } from '@/lib/auth';
import { getUsers } from '@/lib/gcs';

export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const users = await getUsers();
    const user = users.find(u => userMatchesToken(u, token));

    if (!user) {
      return Response.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { password_hash, session_token, ...safeUser } = user;
    return Response.json({ user: safeUser });
  } catch (err) {
    console.error('Auth check error:', err);
    return Response.json({ error: 'Auth check failed' }, { status: 500 });
  }
}
