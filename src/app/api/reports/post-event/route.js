export const dynamic = 'force-dynamic';

import { getUsers, getCustomers, getInteractions, getEvents, getEmailLogs, getSettings } from '@/lib/gcs';
import nodemailer from 'nodemailer';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

// GET: return attendees with their interactions and which reps interacted
export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });
    }

    const [customers, interactions, events, users, emails] = await Promise.all([
      getCustomers(), getInteractions(), getEvents(), getUsers(), getEmailLogs(),
    ]);

    const activeEvent = events.find(e => e.status === 'active');
    const attendees = customers.filter(c => c.status === 'attended');

    // Build attendee data with interactions and reps
    const attendeeData = attendees.map(a => {
      const custInteractions = interactions
        .filter(i => i.customer_id === a.id)
        .sort((x, y) => new Date(y.created_at) - new Date(x.created_at));

      // Unique reps who interacted with this attendee
      const repMap = {};
      custInteractions.forEach(i => {
        if (i.sales_rep_id && i.sales_rep_name) {
          repMap[i.sales_rep_id] = i.sales_rep_name;
        }
      });

      const custEmails = emails.filter(e => e.customer_id === a.id);

      return {
        id: a.id,
        full_name: a.full_name,
        title: a.title || '',
        company_name: a.company_name || '',
        email: a.email || '',
        phone: a.phone || '',
        status: a.status,
        rsvp_responded_at: a.rsvp_responded_at || '',
        interactions: custInteractions,
        interaction_count: custInteractions.length,
        reps: Object.entries(repMap).map(([id, name]) => ({ id, name })),
        email_count: custEmails.length,
      };
    });

    // Get all sales reps/users for the rep selector
    const allReps = users.filter(u => u.role === 'sales_rep' || u.role === 'supervisor').map(u => ({
      id: u.id, full_name: u.full_name, email: u.email, role: u.role,
    }));

    return Response.json({
      event: activeEvent ? { id: activeEvent.id, name: activeEvent.name, event_date: activeEvent.event_date } : null,
      attendees: attendeeData,
      reps: allReps,
      total_customers: customers.length,
      total_interactions: interactions.length,
    });
  } catch (err) {
    console.error('Post-event report error:', err);
    return Response.json({ error: 'Failed to load report data' }, { status: 500 });
  }
}

// POST: send report to selected reps or generate CSV
export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });
    }

    const { action, rep_ids, attendee_ids } = await request.json();

    const [customers, interactions, events, users, emails, settings] = await Promise.all([
      getCustomers(), getInteractions(), getEvents(), getUsers(), getEmailLogs(), getSettings(),
    ]);

    const activeEvent = events.find(e => e.status === 'active');
    const targetAttendees = attendee_ids
      ? customers.filter(c => attendee_ids.includes(c.id))
      : customers.filter(c => c.status === 'attended');

    if (action === 'csv') {
      // Generate CSV of all event data
      const rows = [];
      rows.push(['Name', 'Title', 'Company', 'Email', 'Phone', 'Status', 'RSVP Date', 'Interactions', 'Notes Summary', 'Reps Involved'].join(','));

      targetAttendees.forEach(a => {
        const custInteractions = interactions.filter(i => i.customer_id === a.id);
        const repNames = [...new Set(custInteractions.map(i => i.sales_rep_name).filter(Boolean))];
        const notesSummary = custInteractions
          .filter(i => i.notes)
          .map(i => `[${i.sales_rep_name || 'System'}] ${i.notes}`)
          .join(' | ');

        rows.push([
          `"${(a.full_name || '').replace(/"/g, '""')}"`,
          `"${(a.title || '').replace(/"/g, '""')}"`,
          `"${(a.company_name || '').replace(/"/g, '""')}"`,
          `"${(a.email || '').replace(/"/g, '""')}"`,
          `"${(a.phone || '').replace(/"/g, '""')}"`,
          a.status || '',
          a.rsvp_responded_at ? new Date(a.rsvp_responded_at).toLocaleDateString() : '',
          custInteractions.length,
          `"${notesSummary.replace(/"/g, '""')}"`,
          `"${repNames.join(', ')}"`,
        ].join(','));
      });

      const csv = rows.join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="post-event-report-${activeEvent?.name || 'export'}.csv"`,
        },
      });
    }

    if (action === 'email') {
      if (!rep_ids || !rep_ids.length) {
        return Response.json({ error: 'No reps selected' }, { status: 400 });
      }
      if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
        return Response.json({ error: 'SMTP not configured' }, { status: 400 });
      }

      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: parseInt(settings.smtp_port) || 587,
        secure: parseInt(settings.smtp_port) === 465,
        auth: { user: settings.smtp_user, pass: settings.smtp_pass },
      });

      const fromAddress = settings.smtp_from || settings.smtp_user;
      const companyName = settings.company_name || 'CorpMarketer';
      let sentCount = 0;

      for (const repId of rep_ids) {
        const rep = users.find(u => u.id === repId);
        if (!rep) continue;

        // Get attendees this rep interacted with
        const repAttendeeIds = [...new Set(
          interactions.filter(i => i.sales_rep_id === repId).map(i => i.customer_id)
        )];
        const repAttendees = targetAttendees.filter(a => repAttendeeIds.includes(a.id));

        if (repAttendees.length === 0) continue;

        // Build HTML report for this rep
        let attendeeRows = '';
        repAttendees.forEach(a => {
          const custInteractions = interactions
            .filter(i => i.customer_id === a.id)
            .sort((x, y) => new Date(x.created_at) - new Date(y.created_at));

          let notesHtml = '';
          custInteractions.forEach(i => {
            if (i.notes) {
              notesHtml += `<div style="margin:4px 0;padding:6px 10px;background:#F9FAFB;border-radius:4px;font-size:13px;">
                <span style="color:#6B7280;font-size:11px;">${i.sales_rep_name || 'System'} · ${new Date(i.created_at).toLocaleString()}</span><br/>
                ${i.notes}
              </div>`;
            }
          });

          attendeeRows += `
            <tr style="border-bottom:1px solid #E5E7EB;">
              <td style="padding:12px;vertical-align:top;">
                <strong style="color:#1F2937;">${a.full_name}</strong><br/>
                ${a.title ? `<span style="color:#6366F1;font-size:13px;">${a.title}</span><br/>` : ''}
                ${a.company_name ? `<span style="color:#6B7280;font-size:13px;">${a.company_name}</span><br/>` : ''}
                <span style="color:#9CA3AF;font-size:12px;">${a.email}${a.phone ? ' · ' + a.phone : ''}</span>
              </td>
              <td style="padding:12px;vertical-align:top;">
                ${notesHtml || '<span style="color:#D1D5DB;">No notes</span>'}
              </td>
            </tr>`;
        });

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#333;">
  <h2 style="color:#4F46E5;">Post-Event Report: ${activeEvent?.name || 'Event'}</h2>
  <p style="color:#6B7280;">Date: ${activeEvent?.event_date || 'N/A'}</p>
  <p>Hi ${rep.full_name},</p>
  <p>Here is a summary of the ${repAttendees.length} attendee${repAttendees.length !== 1 ? 's' : ''} you interacted with, along with all recorded interaction notes:</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
    <thead>
      <tr style="background:#F3F4F6;border-bottom:2px solid #E5E7EB;">
        <th style="padding:10px;text-align:left;font-size:12px;color:#6B7280;text-transform:uppercase;">Attendee</th>
        <th style="padding:10px;text-align:left;font-size:12px;color:#6B7280;text-transform:uppercase;">Interaction Notes</th>
      </tr>
    </thead>
    <tbody>${attendeeRows}</tbody>
  </table>
  <p style="color:#9CA3AF;font-size:12px;margin-top:32px;">Sent by ${companyName} via CorpMarketer</p>
</body></html>`;

        try {
          await transporter.sendMail({
            from: `"${companyName}" <${fromAddress}>`,
            to: rep.email,
            subject: `Post-Event Report: ${activeEvent?.name || 'Event'} — Your Interactions`,
            html,
          });
          sentCount++;
        } catch (err) {
          console.error(`Failed to send report to ${rep.email}:`, err.message);
        }
      }

      return Response.json({ sent: sentCount, message: `Sent reports to ${sentCount} rep${sentCount !== 1 ? 's' : ''}.` });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Post-event action error:', err);
    return Response.json({ error: 'Failed: ' + err.message }, { status: 500 });
  }
}
