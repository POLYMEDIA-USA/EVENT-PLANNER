export const dynamic = 'force-dynamic';

import { getCustomers, saveCustomers, getUsers } from '@/lib/gcs';
import { userMatchesToken } from '@/lib/auth';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => userMatchesToken(u, token)) || null;
}

// POST /api/training/reset-leads
// Body: { ids: [customer_id, ...] }
// Admin-only. Resets each lead back to "possible" with no RSVP token, no QR code,
// no attendance flags, and no email-history timestamps. Used to replay training
// scenarios on the same dummy leads without recreating them.
export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'ids array required' }, { status: 400 });
    }

    const customers = await getCustomers();
    const targets = new Set(ids);
    let reset = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < customers.length; i++) {
      if (!targets.has(customers[i].id)) continue;
      const c = customers[i];

      // Reset every field that tracks workflow progression
      c.status = 'possible';
      c.rsvp_token = '';
      c.qr_code_data = '';
      c.rsvp_responded_at = '';
      c.attended_at = '';
      c.invited_at = '';
      c.invite_sent_at = '';
      c.last_invitation_at = '';
      c.last_reminder_at = '';
      c.last_confirmation_at = '';
      c.last_event_update_at = '';
      c.last_custom_at = '';
      c.updated_at = now;

      customers[i] = c;
      reset++;
    }

    await saveCustomers(customers);
    return Response.json({ reset, message: `Reset ${reset} lead${reset !== 1 ? 's' : ''} to "possible" for training.` });
  } catch (err) {
    console.error('Reset training leads error:', err);
    return Response.json({ error: 'Failed: ' + err.message }, { status: 500 });
  }
}
