export const dynamic = 'force-dynamic';

import { getUsers, getCustomers, saveCustomers, getEvents, getSettings, getEmailLogs, saveEmailLogs } from '@/lib/gcs';
import { generateRSVPToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

function buildEmailHTML(type, customer, event, settings, baseUrl, customMessage) {
  const rsvpAcceptUrl = `${baseUrl}/rsvp?token=${customer.rsvp_token}&action=accept`;
  const rsvpDeclineUrl = `${baseUrl}/rsvp?token=${customer.rsvp_token}&action=decline`;
  const logoUrl = settings.company_logo_url || '';
  const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${settings.company_name || 'Logo'}" style="max-height:60px;margin-bottom:16px;" />` : '';
  const companyName = settings.company_name || 'FunnelFlow';

  const eventBlock = `
    <div style="background:#F3F4F6;border-radius:8px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 8px;color:#1F2937;">${event.name}</h3>
      <p style="margin:4px 0;color:#6B7280;">Date: ${event.event_date}</p>
      <p style="margin:4px 0;color:#6B7280;">Time: ${event.event_time}</p>
      <p style="margin:4px 0;color:#6B7280;">Location: ${event.location}</p>
    </div>`;

  const rsvpButtons = `
    <div style="margin:24px 0;">
      <a href="${rsvpAcceptUrl}" style="display:inline-block;padding:12px 32px;background:#059669;color:white;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">I'll Attend</a>
      <a href="${rsvpDeclineUrl}" style="display:inline-block;padding:12px 32px;background:#DC2626;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Decline</a>
    </div>`;

  const footer = `<p style="color:#9CA3AF;font-size:12px;margin-top:32px;">Sent by ${companyName} via FunnelFlow</p>`;

  let subject = '';
  let body = '';

  switch (type) {
    case 'invitation':
      subject = `You're Invited: ${event.name}`;
      body = `
        ${logoHtml}
        <h2 style="color:#4F46E5;">You're Invited!</h2>
        <p>Dear ${customer.full_name},</p>
        <p>We are pleased to invite you to the following event:</p>
        ${eventBlock}
        <p>Please let us know if you can attend:</p>
        ${rsvpButtons}
        ${footer}`;
      break;

    case 'reminder':
      subject = `Reminder: ${event.name} - Please RSVP`;
      body = `
        ${logoHtml}
        <h2 style="color:#4F46E5;">Friendly Reminder</h2>
        <p>Dear ${customer.full_name},</p>
        <p>We wanted to follow up on our invitation to the following event. We haven't received your RSVP yet and would love to hear from you!</p>
        ${eventBlock}
        <p>Please let us know if you can make it:</p>
        ${rsvpButtons}
        ${footer}`;
      break;

    case 'confirmation':
      const qrUrl = customer.qr_code_data
        ? `<div style="margin:16px 0;text-align:center;">
            <p style="font-weight:bold;">Your Check-In QR Code:</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(customer.qr_code_data)}" alt="QR Code" style="margin:8px auto;" />
            <p style="color:#6B7280;font-size:12px;">Show this at the event for check-in</p>
            <div style="margin-top:12px;padding:10px 16px;background:#F3F4F6;border-radius:6px;display:inline-block;">
              <p style="color:#6B7280;font-size:11px;margin:0 0 4px;">Manual check-in code:</p>
              <p style="font-family:monospace;font-size:13px;font-weight:bold;color:#1F2937;margin:0;word-break:break-all;">${customer.qr_code_data}</p>
            </div>
          </div>`
        : '';
      subject = `Confirmed: ${event.name} - See You There!`;
      body = `
        ${logoHtml}
        <h2 style="color:#059669;">You're Confirmed!</h2>
        <p>Dear ${customer.full_name},</p>
        <p>Thank you for confirming your attendance! We're excited to see you at:</p>
        ${eventBlock}
        ${qrUrl}
        <p>If your plans change, please let us know.</p>
        ${footer}`;
      break;

    case 'event_update':
      subject = `Event Update: ${event.name}`;
      body = `
        ${logoHtml}
        <h2 style="color:#4F46E5;">Event Update</h2>
        <p>Dear ${customer.full_name},</p>
        <p>We wanted to share updated details for the following event:</p>
        ${eventBlock}
        <p>Please review the updated information above. If you have any questions, don't hesitate to reach out.</p>
        ${rsvpButtons}
        ${footer}`;
      break;

    case 'custom':
      subject = customMessage?.subject || `Message from ${companyName}: ${event.name}`;
      body = `
        ${logoHtml}
        <p>Dear ${customer.full_name},</p>
        <div style="margin:16px 0;white-space:pre-wrap;">${customMessage?.body || ''}</div>
        ${eventBlock}
        ${footer}`;
      break;

    default:
      subject = `${event.name}`;
      body = `<p>Dear ${customer.full_name},</p><p>You have a message regarding ${event.name}.</p>${footer}`;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  ${body}
</body></html>`;

  return { subject, html };
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { customer_ids, email_type, custom_message } = await request.json();

    if (!customer_ids || !customer_ids.length) {
      return Response.json({ error: 'No customers selected' }, { status: 400 });
    }
    if (!email_type) {
      return Response.json({ error: 'Email type is required' }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      return Response.json({ error: 'Email not configured. Go to Settings and enter SMTP host, user, and password.' }, { status: 400 });
    }

    const customers = await getCustomers();
    const events = await getEvents();
    const activeEvent = events.find(e => e.status === 'active');
    if (!activeEvent) {
      return Response.json({ error: 'No active event found' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port) || 587,
      secure: parseInt(settings.smtp_port) === 465,
      auth: { user: settings.smtp_user, pass: settings.smtp_pass },
    });

    const baseUrl = settings.app_url || request.headers.get('origin') || 'http://localhost:3000';
    const fromAddress = settings.smtp_from || settings.smtp_user;
    const emailLogs = await getEmailLogs();
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const id of customer_ids) {
      const idx = customers.findIndex(c => c.id === id);
      if (idx === -1) continue;

      const customer = customers[idx];

      // Ensure RSVP token exists
      if (!customer.rsvp_token) {
        customer.rsvp_token = generateRSVPToken();
        customers[idx] = customer;
      }

      const { subject, html } = buildEmailHTML(email_type, customer, activeEvent, settings, baseUrl, custom_message);

      // Build log entry ID early so we can use it in the tracking pixel
      const logEntryId = uuidv4();
      const appUrl = settings.app_url || baseUrl;
      const trackingPixel = `<img src="${appUrl}/api/email/track?type=open&id=${logEntryId}" width="1" height="1" style="display:none" />`;
      const trackedHtml = html.replace('</body>', `${trackingPixel}</body>`);

      let emailStatus = 'sent';
      try {
        await transporter.sendMail({
          from: `"${settings.company_name || 'FunnelFlow'}" <${fromAddress}>`,
          to: customer.email,
          subject,
          html: trackedHtml,
        });
        sent++;
      } catch (err) {
        console.error(`Failed to send to ${customer.email}:`, err.message);
        emailStatus = 'failed';
        failed++;
        errors.push(`${customer.email}: ${err.message}`);
      }

      emailLogs.push({
        id: logEntryId,
        direction: 'outbound',
        type: email_type,
        from: fromAddress,
        to: customer.email,
        subject,
        html_body: html,
        customer_id: customer.id,
        customer_name: customer.full_name,
        event_id: activeEvent.id,
        event_name: activeEvent.name,
        sent_by: user.full_name,
        status: emailStatus,
        error: emailStatus === 'failed' ? errors[errors.length - 1] : '',
        created_at: new Date().toISOString(),
      });

      if (emailStatus === 'sent') {
        // Change status from "approved" to "invited" now that the email was actually sent
        if (customer.status === 'approved') {
          customer.status = 'invited';
          customer.invited_at = new Date().toISOString();
        }
        customer.invite_sent_at = customer.invite_sent_at || new Date().toISOString();
        customer[`last_${email_type}_at`] = new Date().toISOString();
        customers[idx] = customer;
      }
    }

    await saveCustomers(customers);
    await saveEmailLogs(emailLogs);

    const message = failed > 0
      ? `Sent ${sent}, failed ${failed}. Check email log for details.`
      : `Successfully sent ${sent} ${email_type} email${sent !== 1 ? 's' : ''}!`;

    return Response.json({ sent, failed, message, errors });
  } catch (err) {
    console.error('Send invites error:', err);
    return Response.json({ error: 'Failed to send emails: ' + err.message }, { status: 500 });
  }
}
