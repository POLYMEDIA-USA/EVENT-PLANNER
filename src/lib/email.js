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
