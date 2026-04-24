export const dynamic = 'force-dynamic';

import { getUsers, getTeamAttendance, saveTeamAttendance, getEvents, getCustomers } from '@/lib/gcs';
import { generateRSVPToken, generateUniqueQRCode, userMatchesToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => userMatchesToken(u, token)) || null;
}

// GET /api/team/attendance?event_id=<id>
// Returns all attendance records for an event, enriched with user info (full_name, email, role, org).
// Also returns the full user list so the UI can show "Invite to Work" candidates (users without a record yet).
export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    const [users, attendance] = await Promise.all([getUsers(), getTeamAttendance()]);

    const scopedAttendance = eventId ? attendance.filter(a => a.event_id === eventId) : attendance;

    // Enrich each record with user info (strip secrets)
    const enriched = scopedAttendance.map(a => {
      const u = users.find(x => x.id === a.user_id);
      return {
        ...a,
        user_full_name: u?.full_name || '(unknown user)',
        user_email: u?.email || '',
        user_phone: u?.phone || '',
        user_role: u?.role || '',
        user_organization_name: u?.organization_name || '',
      };
    });

    // Candidates: active users without a record for this event
    const recordedUserIds = new Set(scopedAttendance.map(a => a.user_id));
    const candidates = users
      .filter(u => !recordedUserIds.has(u.id))
      .map(({ password_hash, session_token, reset_token, reset_token_expires, ...safe }) => safe);

    return Response.json({ attendance: enriched, candidates });
  } catch (err) {
    console.error('Team attendance GET error:', err);
    return Response.json({ error: 'Failed to fetch team attendance' }, { status: 500 });
  }
}

// POST /api/team/attendance
// Body: { action, event_id, user_ids?, attendance_id?, status?, notes? }
//   action='invite'   → create records with status='invited' and a fresh rsvp_token
//   action='mark'     → manual override status for one record (confirmed / declined / present)
//   action='delete'   → remove a record
export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });
    }

    const body = await request.json();
    const { action, event_id, user_ids, attendance_id, status, notes } = body;

    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    const events = await getEvents();
    const event = event_id ? events.find(e => e.id === event_id) : null;

    const attendance = await getTeamAttendance();
    const now = new Date().toISOString();

    if (action === 'invite') {
      if (!event_id || !event) return Response.json({ error: 'event_id required' }, { status: 400 });
      if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return Response.json({ error: 'user_ids required' }, { status: 400 });
      }
      let created = 0;
      let skipped = 0;
      for (const uid of user_ids) {
        const exists = attendance.find(a => a.user_id === uid && a.event_id === event_id);
        if (exists) { skipped++; continue; }
        attendance.push({
          id: uuidv4(),
          user_id: uid,
          event_id,
          status: 'pending', // status becomes 'invited' only after send succeeds
          rsvp_token: generateRSVPToken(),
          qr_code_data: '',
          rsvp_sent_at: '',
          rsvp_responded_at: '',
          confirmation_sent_at: '',
          checkin_at: '',
          invited_via: '',
          notes: '',
          created_at: now,
          updated_at: now,
        });
        created++;
      }
      await saveTeamAttendance(attendance);
      return Response.json({ created, skipped, total: attendance.length });
    }

    if (action === 'mark') {
      if (!attendance_id) return Response.json({ error: 'attendance_id required' }, { status: 400 });
      const idx = attendance.findIndex(a => a.id === attendance_id);
      if (idx === -1) return Response.json({ error: 'Not found' }, { status: 404 });
      const rec = attendance[idx];
      const allowed = new Set(['pending', 'invited', 'confirmed', 'declined', 'present']);
      if (!allowed.has(status)) return Response.json({ error: 'invalid status' }, { status: 400 });

      rec.status = status;
      rec.updated_at = now;
      if (notes !== undefined) rec.notes = notes;

      if (status === 'confirmed') {
        rec.rsvp_responded_at = rec.rsvp_responded_at || now;
        if (!rec.qr_code_data) {
          const customers = await getCustomers();
          rec.qr_code_data = generateUniqueQRCode(customers, attendance);
        }
      } else if (status === 'declined') {
        rec.rsvp_responded_at = rec.rsvp_responded_at || now;
      } else if (status === 'present') {
        rec.checkin_at = rec.checkin_at || now;
        // Minting QR here too so manual "present" override also has a code for records
        if (!rec.qr_code_data) {
          const customers = await getCustomers();
          rec.qr_code_data = generateUniqueQRCode(customers, attendance);
        }
      }

      attendance[idx] = rec;
      await saveTeamAttendance(attendance);
      return Response.json({ attendance: rec });
    }

    if (action === 'delete') {
      if (!attendance_id) return Response.json({ error: 'attendance_id required' }, { status: 400 });
      const next = attendance.filter(a => a.id !== attendance_id);
      if (next.length === attendance.length) return Response.json({ error: 'Not found' }, { status: 404 });
      await saveTeamAttendance(next);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Team attendance POST error:', err);
    return Response.json({ error: 'Failed: ' + err.message }, { status: 500 });
  }
}
