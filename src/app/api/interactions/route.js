export const dynamic = 'force-dynamic';

import { userMatchesToken } from '@/lib/auth';
import { getUsers, getCustomers, saveCustomers, getInteractions, saveInteractions, getTeamAttendance, saveTeamAttendance, getEvents, getSettings, getEmailLogs, saveEmailLogs } from '@/lib/gcs';
import { buildLeadArrivalAlert, isTrainingCustomer } from '@/lib/email';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => userMatchesToken(u, token)) || null;
}

function normalizeOrgName(n) {
  if (!n) return '';
  return n.toLowerCase().trim().replace(/\s+/g, ' ')
    .replace(/\binc\.?\b/g, '').replace(/\bcorp\.?\b/g, '')
    .replace(/\bllc\.?\b/g, '').replace(/\bltd\.?\b/g, '')
    .replace(/\bco\.?\b/g, '').replace(/[.,]/g, '').trim();
}

/**
 * Notify the lead's assigned rep (and their supervisor) by email that the
 * lead just walked into the event. Best-effort: errors are logged and swallowed
 * so a scan never fails because of an SMTP hiccup.
 */
async function sendArrivalAlert(customer, eventIdHint, request) {
  if (!customer?.assigned_rep_id) return;

  const [users, events, settings, emailLogs] = await Promise.all([
    getUsers(), getEvents(), getSettings(), getEmailLogs(),
  ]);

  const rep = users.find(u => u.id === customer.assigned_rep_id);
  if (!rep || !rep.email) return;

  // Find supervisor(s) in the rep's org. Use exact org_id match first, fall
  // back to fuzzy org-name match (same pattern as /api/reps).
  const supervisors = users.filter(u =>
    u.role === 'supervisor' && u.email && u.id !== rep.id && (
      u.organization_id === rep.organization_id ||
      normalizeOrgName(u.organization_name) === normalizeOrgName(rep.organization_name)
    )
  );

  // Resolve event for the alert body
  let event = null;
  if (eventIdHint) event = events.find(e => e.id === eventIdHint);
  if (!event) event = events.find(e => e.status === 'active');

  if (!settings?.smtp_host || !settings?.smtp_user || !settings?.smtp_pass) {
    console.warn('Lead arrival alert skipped — SMTP not configured.');
    return;
  }

  const baseUrl = settings.app_url || request.headers.get('origin') || '';
  const fromAddress = settings.smtp_from || settings.smtp_user;
  const companyName = settings.company_name || 'FunnelFlow';

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: parseInt(settings.smtp_port) || 587,
    secure: parseInt(settings.smtp_port) === 465,
    auth: { user: settings.smtp_user, pass: settings.smtp_pass },
  });

  const { subject, html } = buildLeadArrivalAlert({
    customer,
    event,
    settings,
    baseUrl,
    isTraining: isTrainingCustomer(customer),
  });

  const recipients = [rep, ...supervisors];
  for (const recipient of recipients) {
    const logId = uuidv4();
    let status = 'sent';
    try {
      await transporter.sendMail({
        from: `"${companyName}" <${fromAddress}>`,
        to: recipient.email,
        subject,
        html,
      });
    } catch (err) {
      console.error(`Lead arrival alert to ${recipient.email} failed:`, err.message);
      status = 'failed';
    }
    const isTraining = isTrainingCustomer(customer);
    emailLogs.push({
      id: logId,
      direction: 'outbound',
      type: isTraining ? 'lead_arrival_alert_training' : 'lead_arrival_alert',
      from: fromAddress,
      to: recipient.email,
      subject,
      html_body: html,
      customer_id: customer.id,
      customer_name: customer.full_name,
      event_id: event?.id || '',
      event_name: event?.name || '',
      sent_by: isTraining ? 'system (training drill)' : 'system (arrival alert)',
      status,
      is_training: isTraining || undefined,
      created_at: new Date().toISOString(),
    });
  }
  await saveEmailLogs(emailLogs);
}

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let interactions = await getInteractions();

    // Visibility: all authenticated users see all interactions. Lead visibility is
    // already enforced at /api/leads — if a user can't open a lead, they won't have
    // a way to navigate to that lead's notes anyway. When a user CAN see a lead
    // (their own, assigned, walk-up attendee, etc.) they should see every note on
    // it regardless of who wrote it, so reps can pick up where the admin left off
    // at check-in or vice versa.

    // Enrich with customer info
    const customers = await getCustomers();
    const enriched = interactions.map(i => {
      const customer = customers.find(c => c.id === i.customer_id);
      return { ...i, customer_name: customer?.full_name || 'Unknown', customer_email: customer?.email || '' };
    });

    return Response.json({ interactions: enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
  } catch (err) {
    console.error('Interactions GET error:', err);
    return Response.json({ error: 'Failed to fetch interactions' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { customer_id, event_id, notes, interaction_type, qr_data, attachments } = await request.json();

    // If QR scan, find customer by QR data
    let resolvedCustomerId = customer_id;
    let resolvedCustomer = null;
    const customers = await getCustomers();

    if (qr_data && !customer_id) {
      // Customer and team-attendance codes share one namespace.
      // Check customers first, then team attendance.
      const customer = customers.find(c => c.qr_code_data === qr_data);
      if (customer) {
        resolvedCustomerId = customer.id;
        resolvedCustomer = customer;

        // Flip to "in_the_room" — transient live-event status. Auto-migrates to
        // "attended" after the event closes. Skip the flip if the lead is already
        // attended (post-close) so a re-scan doesn't bounce them backward.
        const idx = customers.findIndex(c => c.id === customer.id);
        let didCheckIn = false;
        if (idx !== -1 && customers[idx].status !== 'attended' && customers[idx].status !== 'in_the_room') {
          customers[idx].status = 'in_the_room';
          customers[idx].attended_at = new Date().toISOString();
          await saveCustomers(customers);
          didCheckIn = true;
          resolvedCustomer = customers[idx];
        }
        // Fire-and-forget alert email to the assigned rep + their supervisor.
        // Don't block the scan response if email fails — admin already has the
        // success card. Training leads also send so reps see the full real-event
        // flow during drills; the email is clearly marked [TRAINING] in subject
        // and body so recipients know it's a drill.
        if (didCheckIn) {
          sendArrivalAlert(customers[idx], event_id, request).catch(err => {
            console.error('Lead arrival alert send failed:', err);
          });
        }
      } else {
        // Try team attendance — scanning a staff QR flips them to "present"
        const attendance = await getTeamAttendance();
        const aIdx = attendance.findIndex(a => a.qr_code_data === qr_data);
        if (aIdx === -1) return Response.json({ error: 'Invalid QR code' }, { status: 404 });

        const rec = attendance[aIdx];
        const now = new Date().toISOString();
        rec.status = 'present';
        rec.checkin_at = rec.checkin_at || now;
        rec.updated_at = now;
        attendance[aIdx] = rec;
        await saveTeamAttendance(attendance);

        // Look up user for the response card
        const allUsers = await getUsers();
        const uRec = allUsers.find(x => x.id === rec.user_id);
        return Response.json({
          kind: 'team',
          attendance: rec,
          user: uRec ? {
            full_name: uRec.full_name,
            email: uRec.email,
            role: uRec.role,
            organization_name: uRec.organization_name || '',
          } : null,
        });
      }
    } else if (resolvedCustomerId) {
      resolvedCustomer = customers.find(c => c.id === resolvedCustomerId) || null;

      // If this is a check-in (qr_scan type) by customer ID, flip to in_the_room
      if (interaction_type === 'qr_scan' && resolvedCustomer) {
        const idx = customers.findIndex(c => c.id === resolvedCustomerId);
        if (idx !== -1 && customers[idx].status !== 'attended' && customers[idx].status !== 'in_the_room') {
          customers[idx].status = 'in_the_room';
          customers[idx].attended_at = new Date().toISOString();
          await saveCustomers(customers);
          sendArrivalAlert(customers[idx], event_id, request).catch(err => {
            console.error('Lead arrival alert send failed:', err);
          });
        }
      }
    }

    if (!resolvedCustomerId) {
      return Response.json({ error: 'Customer ID or QR data required' }, { status: 400 });
    }

    const interactions = await getInteractions();
    const interaction = {
      id: uuidv4(),
      event_id: event_id || '',
      customer_id: resolvedCustomerId,
      sales_rep_id: user.id,
      sales_rep_name: user.full_name,
      notes: notes || '',
      interaction_type: interaction_type || 'manual_note',
      attachments: attachments || [],
      created_at: new Date().toISOString(),
    };

    interactions.push(interaction);
    await saveInteractions(interactions);

    return Response.json({
      interaction,
      customer: resolvedCustomer ? {
        full_name: resolvedCustomer.full_name,
        title: resolvedCustomer.title || '',
        company_name: resolvedCustomer.company_name || '',
        organization_name: resolvedCustomer.organization_name || '',
        email: resolvedCustomer.email || '',
      } : null,
    });
  } catch (err) {
    console.error('Interactions POST error:', err);
    return Response.json({ error: 'Failed to log interaction' }, { status: 500 });
  }
}
