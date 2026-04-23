export const dynamic = 'force-dynamic';

import { getUsers, getEvents, getCustomers, getTeamAttendance, saveTeamAttendance } from '@/lib/gcs';
import { generateUniqueQRCode } from '@/lib/auth';

// GET — read-only: validates the token and returns attendance status. Mirrors /api/rsvp
// so email security scanners that pre-fetch links can't mutate state (the v0.7.5 lesson).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

  const [attendance, users, events] = await Promise.all([getTeamAttendance(), getUsers(), getEvents()]);
  const rec = attendance.find(a => a.rsvp_token === token);
  if (!rec) return Response.json({ error: 'Invalid or expired RSVP token' }, { status: 404 });

  const u = users.find(x => x.id === rec.user_id);
  const ev = events.find(e => e.id === rec.event_id);

  return Response.json({
    valid: true,
    user_name: u?.full_name || 'Team member',
    event_name: ev?.name || 'Event',
    event_date: ev?.event_date || '',
    event_time: ev?.event_time || '',
    event_location: ev?.location || '',
    status: rec.status,
    already_responded: !!rec.rsvp_responded_at,
  });
}

// POST — actual RSVP processing (only triggered by a human clicking the confirm button on /team-rsvp).
export async function POST(request) {
  try {
    const { token, action } = await request.json();
    if (!token || !action) return Response.json({ error: 'Invalid RSVP request' }, { status: 400 });

    const attendance = await getTeamAttendance();
    const idx = attendance.findIndex(a => a.rsvp_token === token);
    if (idx === -1) return Response.json({ error: 'Invalid or expired RSVP token' }, { status: 404 });

    const rec = attendance[idx];

    // Lock after first response — mirror lead RSVP behavior
    if (rec.rsvp_responded_at) {
      return Response.json({
        status: rec.status,
        qr_code_data: rec.qr_code_data || null,
        already_responded: true,
      });
    }

    const now = new Date().toISOString();
    if (action === 'accept') {
      rec.status = 'confirmed';
      rec.rsvp_responded_at = now;
      const customers = await getCustomers();
      rec.qr_code_data = generateUniqueQRCode(customers, attendance);
    } else if (action === 'decline') {
      rec.status = 'declined';
      rec.rsvp_responded_at = now;
      rec.qr_code_data = '';
    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
    rec.updated_at = now;
    attendance[idx] = rec;
    await saveTeamAttendance(attendance);

    return Response.json({
      status: rec.status,
      qr_code_data: rec.status === 'confirmed' ? rec.qr_code_data : null,
    });
  } catch (err) {
    console.error('Team RSVP error:', err);
    return Response.json({ error: 'RSVP processing failed' }, { status: 500 });
  }
}
