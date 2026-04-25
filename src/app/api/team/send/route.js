export const dynamic = 'force-dynamic';

import { getUsers, getEvents, getSettings, getTeamAttendance, saveTeamAttendance, getCustomers, getEmailLogs, saveEmailLogs, getEmailTemplates } from '@/lib/gcs';
import { generateRSVPToken, generateUniqueQRCode, userMatchesToken } from '@/lib/auth';
import {
  applyMergeFields,
  buildEventBlock,
  buildRsvpButtons,
  buildLogoHtml,
  buildSignatureBlock,
  buildFooter,
  wrapHtmlDocument,
} from '@/lib/email';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => userMatchesToken(u, token)) || null;
}

function buildBuiltInInvite({ user, event, settings, rec, baseUrl, senderName }) {
  const eventBlock = buildEventBlock(event);
  const logo = buildLogoHtml(settings);
  const sig = buildSignatureBlock(senderName);
  const footer = buildFooter(settings);
  const rsvpButtons = buildRsvpButtons(baseUrl, rec.rsvp_token, 'team');
  return {
    subject: `Will you be working ${event.name}?`,
    html: wrapHtmlDocument(`
      ${logo}
      <h2 style="color:#4F46E5;">Team — Are You Working This Event?</h2>
      <p>Hi ${user.full_name},</p>
      <p>Please confirm whether you'll be attending and working the event below:</p>
      ${eventBlock}
      ${rsvpButtons}
      ${sig}
      ${footer}`),
  };
}

function buildBuiltInConfirmation({ user, event, settings, rec, senderName }) {
  const eventBlock = buildEventBlock(event);
  const logo = buildLogoHtml(settings);
  const sig = buildSignatureBlock(senderName);
  const footer = buildFooter(settings);
  const qrCode = rec.qr_code_data;
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
    html: wrapHtmlDocument(`
      ${logo}
      <h2 style="color:#059669;">You're Confirmed!</h2>
      <p>Hi ${user.full_name},</p>
      <p>Thanks for confirming. Here are the event details and your check-in code:</p>
      ${eventBlock}
      ${qrBlock}
      ${sig}
      ${footer}`),
  };
}

function buildCustomEmail({ user, event, settings, rec, baseUrl, customMessage, senderName }) {
  const eventBlock = buildEventBlock(event);
  const logo = buildLogoHtml(settings);
  const sig = buildSignatureBlock(senderName);
  const footer = buildFooter(settings);
  const rsvpButtons = rec.rsvp_token ? buildRsvpButtons(baseUrl, rec.rsvp_token, 'team') : '';
  return {
    subject: customMessage?.subject || `Message regarding ${event.name}`,
    html: wrapHtmlDocument(`
      ${logo}
      <p>Hi ${user.full_name},</p>
      <div style="margin:16px 0;white-space:pre-wrap;">${customMessage?.body || ''}</div>
      ${eventBlock}
      ${rsvpButtons}
      ${sig}
      ${footer}`),
  };
}

function buildTemplateEmail({ user, event, settings, rec, baseUrl, template, senderName }) {
  const eventBlock = buildEventBlock(event);
  const logo = buildLogoHtml(settings);
  const sig = buildSignatureBlock(senderName);
  const footer = buildFooter(settings);
  const rsvpLink = rec.rsvp_token ? `${baseUrl}/team-rsvp?token=${rec.rsvp_token}` : '';
  const ctx = { recipientName: user.full_name, event, settings, rsvpLink, senderName };
  const subject = applyMergeFields(template.subject || `${event.name}`, ctx);
  const mergedBody = applyMergeFields(template.body_html || '', ctx);
  const rsvpButtons = rec.rsvp_token ? buildRsvpButtons(baseUrl, rec.rsvp_token, 'team') : '';
  return {
    subject,
    html: wrapHtmlDocument(`
      ${logo}
      <div style="margin:8px 0;white-space:pre-wrap;">${mergedBody}</div>
      ${eventBlock}
      ${rsvpButtons}
      ${sig}
      ${footer}`),
  };
}

// POST /api/team/send
// Body:
//   { kind: 'invite' | 'confirmation' | 'custom' | 'template',
//     attendance_ids: [...],
//     custom_message?: { subject, body }, // for kind=custom
//     template_id?: string,                // for kind=template
//     sender_name?: string                 // signature line, defaults to logged-in user
//   }
// Status flow on successful send:
//   invite/custom/template → if rec.status === 'pending', flip to 'invited' and stamp rsvp_sent_at
//   confirmation           → stamp confirmation_sent_at (no status change)
export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });
    }

    const { kind, attendance_ids, custom_message, template_id, sender_name } = await request.json();
    const validKinds = ['invite', 'confirmation', 'custom', 'template'];
    if (!validKinds.includes(kind)) {
      return Response.json({ error: `kind must be one of ${validKinds.join(', ')}` }, { status: 400 });
    }
    if (!Array.isArray(attendance_ids) || attendance_ids.length === 0) {
      return Response.json({ error: 'attendance_ids required' }, { status: 400 });
    }
    if (kind === 'custom' && (!custom_message?.subject || !custom_message?.body)) {
      return Response.json({ error: 'custom_message.subject and body required for custom sends' }, { status: 400 });
    }

    const [settings, users, events, attendance, customers, emailLogs, allTemplates] = await Promise.all([
      getSettings(), getUsers(), getEvents(), getTeamAttendance(), getCustomers(), getEmailLogs(), getEmailTemplates(),
    ]);

    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      return Response.json({ error: 'SMTP not configured. Set it up in Settings.' }, { status: 400 });
    }

    let resolvedTemplate = null;
    if (kind === 'template') {
      if (!template_id) return Response.json({ error: 'template_id required' }, { status: 400 });
      resolvedTemplate = allTemplates.find(t => t.id === template_id);
      if (!resolvedTemplate) return Response.json({ error: 'Template not found' }, { status: 404 });
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
    const resolvedSender = (sender_name && sender_name.trim()) || user.full_name || '';

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

      // Guarantee rsvp_token for invite/custom/template (anything that includes RSVP buttons)
      if (kind !== 'confirmation' && !rec.rsvp_token) rec.rsvp_token = generateRSVPToken();

      // Guarantee qr_code_data for confirmation
      if (kind === 'confirmation' && !rec.qr_code_data) {
        rec.qr_code_data = generateUniqueQRCode(customers, attendance);
      }

      let built;
      if (kind === 'invite') {
        built = buildBuiltInInvite({ user: u, event: ev, settings, rec, baseUrl, senderName: resolvedSender });
      } else if (kind === 'confirmation') {
        built = buildBuiltInConfirmation({ user: u, event: ev, settings, rec, senderName: resolvedSender });
      } else if (kind === 'custom') {
        built = buildCustomEmail({ user: u, event: ev, settings, rec, baseUrl, customMessage: custom_message, senderName: resolvedSender });
      } else if (kind === 'template') {
        built = buildTemplateEmail({ user: u, event: ev, settings, rec, baseUrl, template: resolvedTemplate, senderName: resolvedSender });
      }

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

      // Log type — surface template name for template sends so the email log
      // doesn't collapse every template into the literal string "template".
      let logType;
      if (kind === 'invite') logType = 'team_invite';
      else if (kind === 'confirmation') logType = 'team_confirmation';
      else if (kind === 'custom') logType = 'team_custom';
      else if (kind === 'template') logType = `team_template:${resolvedTemplate?.name || 'unknown'}`;

      emailLogs.push({
        id: logEntryId,
        direction: 'outbound',
        type: logType,
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
        if (kind === 'confirmation') {
          rec.confirmation_sent_at = now;
        } else {
          // invite / custom / template — invitation-class
          if (rec.status === 'pending') rec.status = 'invited';
          rec.rsvp_sent_at = rec.rsvp_sent_at || now;
          rec.invited_via = 'email';
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
