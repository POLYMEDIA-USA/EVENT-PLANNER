export const dynamic = 'force-dynamic';

import { getUsers, getSettings, getEvents, getTeamAttendance, saveTeamAttendance } from '@/lib/gcs';
import { generateRSVPToken } from '@/lib/auth';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

// POST /api/team/sms
// Body: { attendance_ids: [...] }
// Sends an SMS "Will you be working {event}?" with an RSVP link for each selected attendance record.
// Flips status pending → invited on successful send and stamps invited_via='sms'.
export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });
    }

    const { attendance_ids } = await request.json();
    if (!Array.isArray(attendance_ids) || attendance_ids.length === 0) {
      return Response.json({ error: 'attendance_ids required' }, { status: 400 });
    }

    const [settings, users, events, attendance] = await Promise.all([
      getSettings(), getUsers(), getEvents(), getTeamAttendance(),
    ]);

    if (!settings.vonage_api_key || !settings.vonage_api_secret || !settings.vonage_from_number) {
      return Response.json({ error: 'Vonage SMS not configured. Go to Settings and enter Vonage API key, secret, and from number.' }, { status: 400 });
    }

    const baseUrl = settings.app_url || request.headers.get('origin') || 'http://localhost:3000';
    const companyName = settings.company_name || 'FunnelFlow';

    let sent = 0, failed = 0;
    const errors = [];
    const now = new Date().toISOString();

    for (const aid of attendance_ids) {
      const idx = attendance.findIndex(a => a.id === aid);
      if (idx === -1) continue;
      const rec = attendance[idx];
      const u = users.find(x => x.id === rec.user_id);
      const ev = events.find(e => e.id === rec.event_id);
      if (!u || !ev) continue;
      if (!u.phone) { failed++; errors.push(`${u.full_name || rec.user_id}: no phone number`); continue; }

      if (!rec.rsvp_token) rec.rsvp_token = generateRSVPToken();
      const link = `${baseUrl}/team-rsvp?token=${rec.rsvp_token}`;
      const phone = u.phone.replace(/[^\d+]/g, '');
      const text = `${companyName}: Will you be working ${ev.name} on ${ev.event_date}? Respond here: ${link}`;

      try {
        const res = await fetch('https://rest.nexmo.com/sms/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: settings.vonage_api_key,
            api_secret: settings.vonage_api_secret,
            from: settings.vonage_from_number,
            to: phone,
            text,
          }),
        });
        const data = await res.json();
        const msg = data.messages?.[0];
        if (msg && msg.status === '0') {
          sent++;
          if (rec.status === 'pending') rec.status = 'invited';
          rec.rsvp_sent_at = rec.rsvp_sent_at || now;
          rec.invited_via = 'sms';
          rec.updated_at = now;
        } else {
          failed++;
          errors.push(`${u.full_name}: ${msg?.['error-text'] || 'Unknown Vonage error'}`);
        }
      } catch (err) {
        failed++;
        errors.push(`${u.full_name}: ${err.message}`);
      }
      attendance[idx] = rec;
    }

    await saveTeamAttendance(attendance);
    return Response.json({ sent, failed, errors, message: `Sent ${sent} SMS invite${sent !== 1 ? 's' : ''}${failed ? `, failed ${failed}` : ''}.` });
  } catch (err) {
    console.error('Team SMS error:', err);
    return Response.json({ error: 'Failed: ' + err.message }, { status: 500 });
  }
}
