export const dynamic = 'force-dynamic';

import { getUsers, getEvents, getSettings, getTeamAttendance, saveTeamAttendance, getCustomers, getEmailLogs, saveEmailLogs } from '@/lib/gcs';
import { generateRSVPToken, generateUniqueQRCode, userMatchesToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => userMatchesToken(u, token)) || null;
}

function buildInviteHTML({ userName, event, settings, baseUrl, rsvpToken }) {
  const acceptUrl = `${baseUrl}/team-rsvp?token=${rsvpToken}&action=accept`;
  const declineUrl = `${baseUrl}/team-rsvp?token=${rsvpToken}&action=decline`;
  const logoUrl = settings.company_logo_url || '';
  const companyName = settings.company_name || 'FunnelFlow';
  const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:60px;margin-bottom:16px;" />` : '';

  const eventBlock = `
    <div style="background:#F3F4F6;border-radius:8px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 8px;color:#1F2937;">${event.name}</h3>
      <p style="margin:4px 0;color:#6B7280;">Date: ${event.event_date}</p>
      <p style="margin:4px 0;color:#6B7280;">Time: ${event.event_time}</p>
      <p style="margin:4px 0;color:#6B7280;">Location: ${event.location}</p>
    </div>`;

  return {
    subject: `Will you be working ${event.name}?`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  ${logoHtml}
  <h2 style="color:#4F46E5;">Team — Are You Working This Event?</h2>
  <p>Hi ${userName},</p>
  <p>Please confirm whether you'll be attending and working the event below:</p>
  ${eventBlock}
  <div style="margin:24px 0;">
    <a href="${acceptUrl}" style="display:inline-block;padding:12px 32px;background:#059669;color:white;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">Yes, I'll Be There</a>
    <a href="${declineUrl}" style="display:inline-block;padding:12px 32px;background:#DC2626;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Can't Make It</a>
  </div>
  <p style="color:#9CA3AF;font-size:12px;margin-top:32px;">Sent by ${companyName} via FunnelFlow</p>
</body></html>`,
  };
}

function buildConfirmationHTML({ userName, event, settings, qrCode }) {
  const logoUrl = settings.company_logo_url || '';
  const companyName = settings.company_name || 'FunnelFlow';
  const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:60px;margin-bottom:16px;" />` : '';

  const eventBlock = `
    <div style="background:#F3F4F6;border-radius:8px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 8px;color:#1F2937;">${event.name}</h3>
      <p style="margin:4px 0;color:#6B7280;">Date: ${event.event_date}</p>
      <p style="margin:4px 0;color:#6B7280;">Time: ${event.event_time}</p>
      <p style="margin:4px 0;color:#6B7280;">Location: ${event.location}</p>
    </div>`;

  const qrBlock = qrCode ? `
    <div style="margin:16px 0;text-align:center;">
      <p style="font-weight:bold;">Your Staff Check-In Code:</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}" alt="QR Code" style="margin:8px auto;" />
      <p style="color:#6B7280;font-size:12px;">Show this to an admin at the event to check in as team.</p>
      <div style="margin-top:12px;padding:10px 16px;background:#F3F4F6;border-radius:6px;display:inline-block;">
        <p style="color:#6B7280;font-size:11px;margin:0 0 4px;">Manual check-in code:</p>
        <p style="font-family:monospace;font-size:16px;font-weight:bold;color:#1F2937;margin:0;letter-spacing:2px;">${qrCode}</p>
      </div>
    </div>` : '';

  return {
    subject: `Confirmed: ${event.name} — See you there!`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  ${logoHtml}
  <h2 style="color:#059669;">You're Confirmed!</h2>
  <p>Hi ${userName},</p>
  <p>Thanks for confirming. Here are the event details and your check-in code:</p>
  ${eventBlock}
  ${qrBlock}
  <p style="color:#9CA3AF;font-size:12px;margin-top:32px;">Sent by ${companyName} via FunnelFlow</p>
</body></html>`,
  };
}

// POST /api/team/send
// Body: { kind: 'invite' | 'confirmation', attendance_ids: [...] }
// 'invite' sends the "Will you work this event?" email, generates an rsvp_token if missing,
//    and flips status pending → invited on successful send.
// 'confirmation' sends the QR check-in code email. If the target has no qr_code_data yet
//    (admin manually marked them confirmed), mint one and save it.
export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });
    }

    const { kind, attendance_ids } = await request.json();
    if (!['invite', 'confirmation'].includes(kind)) {
      return Response.json({ error: 'kind must be "invite" or "confirmation"' }, { status: 400 });
    }
    if (!Array.isArray(attendance_ids) || attendance_ids.length === 0) {
      return Response.json({ error: 'attendance_ids required' }, { status: 400 });
    }

    const [settings, users, events, attendance, customers, emailLogs] = await Promise.all([
      getSettings(), getUsers(), getEvents(), getTeamAttendance(), getCustomers(), getEmailLogs(),
    ]);

    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      return Response.json({ error: 'SMTP not configured. Set it up in Settings.' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port) || 587,
      secure: parseInt(settings.smtp_port) === 465,
      auth: { user: settings.smtp_user, pass: settings.smtp_pass },
    });

    const baseUrl = settings.app_url || request.headers.get('origin') || 'http://localhost:3000';
    const fromAddress = settings.smtp_from || settings.smtp_user;
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
      if (!u.email) { failed++; errors.push(`${u.full_name || rec.user_id}: no email on record`); continue; }

      // Guarantee rsvp_token (needed for invite email)
      if (kind === 'invite' && !rec.rsvp_token) rec.rsvp_token = generateRSVPToken();

      // Guarantee qr_code_data for confirmation
      if (kind === 'confirmation' && !rec.qr_code_data) {
        rec.qr_code_data = generateUniqueQRCode(customers, attendance);
      }

      const built = kind === 'invite'
        ? buildInviteHTML({ userName: u.full_name, event: ev, settings, baseUrl, rsvpToken: rec.rsvp_token })
        : buildConfirmationHTML({ userName: u.full_name, event: ev, settings, qrCode: rec.qr_code_data });

      const logEntryId = uuidv4();
      const trackingPixel = `<img src="${baseUrl}/api/email/track?type=open&id=${logEntryId}" width="1" height="1" style="display:none" />`;
      const trackedHtml = built.html.replace('</body>', `${trackingPixel}</body>`);

      let emailStatus = 'sent';
      try {
        await transporter.sendMail({
          from: `"${companyName}" <${fromAddress}>`,
          to: u.email,
          subject: built.subject,
          html: trackedHtml,
        });
        sent++;
      } catch (err) {
        console.error(`Failed to send team ${kind} to ${u.email}:`, err.message);
        emailStatus = 'failed';
        failed++;
        errors.push(`${u.email}: ${err.message}`);
      }

      emailLogs.push({
        id: logEntryId,
        direction: 'outbound',
        type: kind === 'invite' ? 'team_invite' : 'team_confirmation',
        from: fromAddress,
        to: u.email,
        subject: built.subject,
        html_body: built.html,
        customer_id: '', // not a lead
        customer_name: u.full_name, // reuse column for display
        event_id: ev.id,
        event_name: ev.name,
        sent_by: user.full_name,
        status: emailStatus,
        error: emailStatus === 'failed' ? errors[errors.length - 1] : '',
        created_at: now,
      });

      if (emailStatus === 'sent') {
        if (kind === 'invite') {
          if (rec.status === 'pending') rec.status = 'invited';
          rec.rsvp_sent_at = rec.rsvp_sent_at || now;
          rec.invited_via = 'email';
        } else {
          rec.confirmation_sent_at = now;
        }
        rec.updated_at = now;
      }
      attendance[idx] = rec;
    }

    await saveTeamAttendance(attendance);
    await saveEmailLogs(emailLogs);

    let message = `Sent ${sent} ${kind} email${sent !== 1 ? 's' : ''}.`;
    if (failed > 0) message += ` Failed: ${failed}.`;
    return Response.json({ sent, failed, message, errors });
  } catch (err) {
    console.error('Team send error:', err);
    return Response.json({ error: 'Failed: ' + err.message }, { status: 500 });
  }
}
