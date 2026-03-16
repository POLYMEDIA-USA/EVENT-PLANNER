export const dynamic = 'force-dynamic';

import { getUsers, saveUsers } from '@/lib/gcs';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const users = await getUsers();
    const safe = users.map(({ password_hash, session_token, ...u }) => u);
    return Response.json({ users: safe });
  } catch (err) {
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await authenticate(request);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { user_id, role } = await request.json();
    if (!['admin', 'sales_rep'].includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const users = await getUsers();
    const idx = users.findIndex(u => u.id === user_id);
    if (idx === -1) return Response.json({ error: 'User not found' }, { status: 404 });

    users[idx].role = role;
    await saveUsers(users);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
