export const dynamic = 'force-dynamic';

import { getUsers, getCustomers, saveCustomers, getEvents, getSettings } from '@/lib/gcs';
import { generateRSVPToken } from '@/lib/auth';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

function buildInviteHTML(customer, event, settings, baseUrl) {
  const rsvpAcceptUrl = `${baseUrl}/rsvp?token=${customer.rsvp_token}&action=accept`;
  const rsvpDeclineUrl = `${baseUrl}/rsvp?token=${customer.rsvp_token}&action=decline`;
  const logoHtml = settings.company_logo_url
    ? `<img src="${settings.company_logo_url}" alt="Logo" style="max-height:60px;margin-bottom:16px;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  ${logoHtml}
  <h2 style="color:#4F46E5;">You're Invited!</h2>
  <p>Dear ${customer.full_name},</p>
  <p>We are pleased to invite you to the following event:</p>
  <div style="background:#F3F4F6;border-radius:8px;padding:16px;margin:16px 0;">
    <h3 style="margin:0 0 8px;color:#1F2937;">${event.name}</h3>
    <p style="margin:4px 0;color:#6B7280;">Date: ${event.event_date}</p>
    <p style="margin:4px 0;color:#6B7280;">Time: ${event.event_time}</p>
    <p style="margin:4px 0;color:#6B7280;">Location: ${event.location}</p>
  </div>
  <p>Please let us know if you can attend:</p>
  <div style="margin:24px 0;">
    <a href="${rsvpAcceptUrl}" style="display:inline-block;padding:12px 32px;background:#059669;color:white;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">I'll Attend</a>
    <a href="${rsvpDeclineUrl}" style="display:inline-block;padding:12px 32px;background:#DC2626;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Decline</a>
  </div>
  <p style="color:#9CA3AF;font-size:12px;">Sent via CorpMarketer</p>
</body>
</html>`;
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { customer_ids } = await request.json();
    const settings = await getSettings();

    if (!settings.smtp_host && !settings.gmail_client_id) {
      return Response.json({ error: 'Email not configured. Go to Settings to configure email.' }, { status: 400 });
    }

    const customers = await getCustomers();
    const events = await getEvents();
    const activeEvent = events.find(e => e.status === 'active');

    if (!activeEvent) {
      return Response.json({ error: 'No active event found' }, { status: 400 });
    }

    const baseUrl = settings.app_url || request.headers.get('origin') || 'http://localhost:3000';
    let sent = 0;

    for (const id of customer_ids) {
      const idx = customers.findIndex(c => c.id === id);
      if (idx === -1) continue;

      const customer = customers[idx];
      if (!customer.rsvp_token) {
        customer.rsvp_token = generateRSVPToken();
      }

      const html = buildInviteHTML(customer, activeEvent, settings, baseUrl);

      // For now, log the email. Real sending requires SMTP/Gmail API setup.
      console.log(`[EMAIL] Would send invite to ${customer.email} for event ${activeEvent.name}`);
      console.log(`[EMAIL] RSVP token: ${customer.rsvp_token}`);

      customer.invite_sent_at = new Date().toISOString();
      customers[idx] = customer;
      sent++;
    }

    await saveCustomers(customers);
    return Response.json({ sent, message: `${sent} invitations queued. Configure SMTP in Settings for actual delivery.` });
  } catch (err) {
    console.error('Send invites error:', err);
    return Response.json({ error: 'Failed to send invitations' }, { status: 500 });
  }
}
