export const dynamic = 'force-dynamic';

import { getUsers, getSettings, saveSettings } from '@/lib/gcs';

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

    const settings = await getSettings();
    // Don't send SMTP password to client
    const { smtp_pass, ...safe } = settings;
    return Response.json({ ...safe, smtp_pass: smtp_pass ? '••••••••' : '' });
  } catch (err) {
    return Response.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const updates = await request.json();
    const current = await getSettings();

    // Don't overwrite password with masked value
    if (updates.smtp_pass === '••••••••') {
      updates.smtp_pass = current.smtp_pass;
    }

    const merged = { ...current, ...updates, updated_at: new Date().toISOString() };
    await saveSettings(merged);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
