/**
 * Shared email-template helpers used by both the lead-send and team-send paths.
 *
 * Why this file exists: the lead path (/api/email/send-invites) and the team path
 * (/api/team/send) both need merge-field substitution, an event-details block,
 * an RSVP button block, a signature block, and a footer. Keeping the logic in
 * one place avoids drift — e.g. v0.10.2 added {{sender_name}} merge support and
 * we want both paths to honour it without duplicating.
 */

/**
 * Substitute supported merge fields inside a string.
 *
 * Both `{{lead_name}}` and `{{recipient_name}}` resolve to the recipient's name,
 * so existing templates written for leads continue to work when used to send
 * to team members.
 */
export function applyMergeFields(str, ctx) {
  if (!str) return '';
  const {
    recipientName = '',
    event = {},
    settings = {},
    rsvpLink = '',
    senderName = '',
  } = ctx || {};
  return str
    .replace(/\{\{\s*(lead_name|recipient_name|team_name)\s*\}\}/g, recipientName)
    .replace(/\{\{\s*event_name\s*\}\}/g, event.name || '')
    .replace(/\{\{\s*event_date\s*\}\}/g, event.event_date || '')
    .replace(/\{\{\s*event_time\s*\}\}/g, event.event_time || '')
    .replace(/\{\{\s*event_location\s*\}\}/g, event.location || '')
    .replace(/\{\{\s*company_name\s*\}\}/g, settings.company_name || '')
    .replace(/\{\{\s*rsvp_link\s*\}\}/g, rsvpLink)
    .replace(/\{\{\s*sender_name\s*\}\}/g, senderName);
}

export function buildEventBlock(event) {
  if (!event?.name) return '';
  return `
    <div style="background:#F3F4F6;border-radius:8px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 8px;color:#1F2937;">${event.name}</h3>
      <p style="margin:4px 0;color:#6B7280;">Date: ${event.event_date || ''}</p>
      <p style="margin:4px 0;color:#6B7280;">Time: ${event.event_time || ''}</p>
      <p style="margin:4px 0;color:#6B7280;">Location: ${event.location || ''}</p>
    </div>`;
}

/**
 * @param baseUrl - the public app URL
 * @param token - the recipient's RSVP token
 * @param kind - 'lead' or 'team' (controls the URL path: /rsvp vs /team-rsvp)
 */
export function buildRsvpButtons(baseUrl, token, kind = 'lead') {
  if (!token) return '';
  const path = kind === 'team' ? 'team-rsvp' : 'rsvp';
  const accept = `${baseUrl}/${path}?token=${token}&action=accept`;
  const decline = `${baseUrl}/${path}?token=${token}&action=decline`;
  const yes = kind === 'team' ? "Yes, I'll Be There" : "I'll Attend";
  const no = kind === 'team' ? "Can't Make It" : 'Decline';
  return `
    <div style="margin:24px 0;">
      <a href="${accept}" style="display:inline-block;padding:12px 32px;background:#059669;color:white;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">${yes}</a>
      <a href="${decline}" style="display:inline-block;padding:12px 32px;background:#DC2626;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">${no}</a>
    </div>`;
}

export function buildLogoHtml(settings) {
  if (!settings?.company_logo_url) return '';
  return `<img src="${settings.company_logo_url}" alt="${settings.company_name || 'Logo'}" style="max-height:60px;margin-bottom:16px;" />`;
}

export function buildSignatureBlock(senderName) {
  if (!senderName) return '';
  return `<div style="margin-top:24px;color:#1F2937;">
    <p style="margin:0 0 4px;">Regards,</p>
    <p style="margin:0;white-space:pre-wrap;font-weight:600;">${senderName}</p>
  </div>`;
}

export function buildFooter(settings) {
  const companyName = settings?.company_name || 'FunnelFlow';
  return `<p style="color:#9CA3AF;font-size:12px;margin-top:32px;">Sent by ${companyName} via FunnelFlow</p>`;
}

/**
 * Wrap a body in the standard outer HTML shell.
 */
export function wrapHtmlDocument(bodyHtml) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  ${bodyHtml}
</body></html>`;
}

/**
 * Build the lead-confirmation email — "You're Confirmed!" with the QR check-in code.
 * Used by both the manual send flow (/api/email/send-invites) and the auto-simulation
 * paths in /api/leads PUT and /api/rsvp POST when a training lead becomes "accepted".
 */
export function buildConfirmationEmailHTML({ customer, event, settings, senderName }) {
  const eventBlock = buildEventBlock(event);
  const logo = buildLogoHtml(settings);
  const sig = buildSignatureBlock(senderName);
  const footer = buildFooter(settings);
  const qrCode = customer?.qr_code_data || '';
  const qrBlock = qrCode ? `
    <div style="margin:16px 0;text-align:center;">
      <p style="font-weight:bold;">Your Check-In QR Code:</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}" alt="QR Code" style="margin:8px auto;" />
      <p style="color:#6B7280;font-size:12px;">Show this at the event for check-in</p>
      <div style="margin-top:12px;padding:10px 16px;background:#F3F4F6;border-radius:6px;display:inline-block;">
        <p style="color:#6B7280;font-size:11px;margin:0 0 4px;">Manual check-in code:</p>
        <p style="font-family:monospace;font-size:16px;font-weight:bold;color:#1F2937;margin:0;letter-spacing:2px;">${qrCode}</p>
      </div>
    </div>` : '';
  const subject = `Confirmed: ${event?.name || 'Event'} - See You There!`;
  const html = wrapHtmlDocument(`
    ${logo}
    <h2 style="color:#059669;">You're Confirmed!</h2>
    <p>Dear ${customer?.full_name || ''},</p>
    <p>Thank you for confirming your attendance! We're excited to see you at:</p>
    ${eventBlock}
    ${qrBlock}
    <p>If your plans change, please let us know.</p>
    ${sig}
    ${footer}`);
  return { subject, html };
}

/**
 * Decide whether a customer record is a "training" lead — used to gate
 * SMTP-skipping and auto-simulation behavior. Two signals:
 *   - is_training=true (set by /api/training/generate-leads)
 *   - email ends in @trainingco.test (RFC 6761 reserved TLD; safety net for
 *     records that may have been created before is_training was added)
 */
export function isTrainingCustomer(customer) {
  if (!customer) return false;
  if (customer.is_training === true) return true;
  const email = (customer.email || '').toLowerCase();
  return email.endsWith('@trainingco.test');
}

/**
 * Build a fully-populated email_logs.json entry for a training-simulated send.
 * Caller appends to logs and persists. Caller is also responsible for the
 * customer-side timestamp updates (last_confirmation_at, confirmation_sent_at, etc.).
 */
/**
 * Build the "lead just walked in" alert sent to the assigned sales rep and
 * their supervisor the moment a lead is QR-scanned at the event door.
 * Concise body so it reads well on a phone notification.
 */
export function buildLeadArrivalAlert({ customer, event, settings, baseUrl, isTraining = false }) {
  const logo = buildLogoHtml(settings);
  const footer = buildFooter(settings);
  const companyName = settings?.company_name || 'FunnelFlow';
  const interactionsLink = baseUrl ? `${baseUrl}/interactions` : '';
  const subjectPrefix = isTraining ? '[TRAINING] ' : '';
  const subject = `${subjectPrefix}🟢 ${customer.full_name} just arrived at ${event?.name || 'the event'}`;
  const trainingBanner = isTraining
    ? `<div style="background:#f3e8ff;border-left:4px solid #9333ea;border-radius:8px;padding:12px 14px;margin:0 0 16px;">
         <p style="margin:0;font-weight:700;color:#6b21a8;font-size:14px;">⚠️ TRAINING DRILL — not a real check-in</p>
         <p style="margin:4px 0 0;color:#7e22ce;font-size:13px;">This is a simulated arrival from a training/dummy lead. The flow you're seeing is identical to a real event check-in so you know what to expect on game day. No action required.</p>
       </div>`
    : '';
  const html = wrapHtmlDocument(`
    ${logo}
    ${trainingBanner}
    <h2 style="color:#4F46E5;margin-bottom:6px;">A lead just walked in</h2>
    <p style="color:#6B7280;margin:0 0 16px;">Heads up — your lead just checked in at the event. Now's the time to find them on the floor.</p>
    <div style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:8px;padding:14px 16px;margin:16px 0;">
      <p style="margin:0 0 4px;font-size:1.05rem;font-weight:600;color:#065f46;">${customer.full_name}</p>
      ${customer.title ? `<p style="margin:2px 0;color:#0f766e;font-size:14px;">${customer.title}</p>` : ''}
      ${customer.company_name ? `<p style="margin:2px 0;color:#374151;font-size:14px;">${customer.company_name}</p>` : ''}
      ${customer.email ? `<p style="margin:2px 0;color:#6B7280;font-size:13px;">${customer.email}</p>` : ''}
      ${customer.phone ? `<p style="margin:2px 0;color:#6B7280;font-size:13px;">${customer.phone}</p>` : ''}
    </div>
    <p>Event: <strong>${event?.name || ''}</strong></p>
    ${interactionsLink ? `<p style="margin:18px 0;"><a href="${interactionsLink}" style="display:inline-block;padding:10px 22px;background:#4F46E5;color:white;text-decoration:none;border-radius:6px;font-weight:600;">Open Interactions in ${companyName}</a></p>` : ''}
    <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">Status will switch from "in the room" to "attended" automatically after the event closes.</p>
    ${footer}`);
  return { subject, html };
}

export function buildTrainingLogEntry({ id, type, customer, event, settings, sentByName, subject, html, note }) {
  return {
    id,
    direction: 'outbound',
    type,
    from: settings?.smtp_from || settings?.smtp_user || '',
    to: customer?.email || '',
    subject,
    html_body: html,
    customer_id: customer?.id || '',
    customer_name: customer?.full_name || '',
    event_id: event?.id || '',
    event_name: event?.name || '',
    sent_by: sentByName || '',
    status: 'sent',
    is_training: true,
    training_note: note || 'Training mode — auto-generated. Stored for preview/print, no SMTP delivery attempted.',
    created_at: new Date().toISOString(),
  };
}
