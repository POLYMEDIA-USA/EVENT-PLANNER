import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { readJSON, writeJSON } from '../../../../lib/gcs';
import { verifyToken } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { user_ids, subject, message } = await request.json();

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: 'user_ids array required' }, { status: 400 });
    }

    if (!subject || !message) {
      return NextResponse.json({ error: 'subject and message required' }, { status: 400 });
    }

    // Get users
    const users = await readJSON('users.json');
    const settings = await readJSON('settings.json');

    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      return NextResponse.json({ error: 'SMTP not configured' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port || 587,
      secure: false,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
    });

    const selectedUsers = users.filter(u => user_ids.includes(u.id));
    let sent = 0;
    let failed = 0;
    const errors = [];
    const emailLogs = await readJSON('email_logs.json') || [];

    for (const u of selectedUsers) {
      try {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${settings.company_name || 'Event Planner'}</h2>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr>
            <p style="color: #666; font-size: 12px;">Sent to ${u.full_name} (${u.email})</p>
          </div>
        `;

        await transporter.sendMail({
          from: settings.smtp_from || settings.smtp_user,
          to: u.email,
          subject,
          html,
        });

        emailLogs.push({
          id: crypto.randomUUID(),
          direction: 'outbound',
          type: 'user_notification',
          from: settings.smtp_from || settings.smtp_user,
          to: u.email,
          subject,
          html_body: html,
          customer_id: null,
          customer_name: null,
          event_id: null,
          event_name: null,
          sent_by: user.id,
          sent_by_name: user.full_name,
          status: 'sent',
          error: null,
          created_at: new Date().toISOString(),
        });

        sent++;
      } catch (error) {
        errors.push({ email: u.email, error: error.message });
        emailLogs.push({
          id: crypto.randomUUID(),
          direction: 'outbound',
          type: 'user_notification',
          from: settings.smtp_from || settings.smtp_user,
          to: u.email,
          subject,
          html_body: '',
          customer_id: null,
          customer_name: null,
          event_id: null,
          event_name: null,
          sent_by: user.id,
          sent_by_name: user.full_name,
          status: 'failed',
          error: error.message,
          created_at: new Date().toISOString(),
        });
        failed++;
      }
    }

    await writeJSON('email_logs.json', emailLogs);

    return NextResponse.json({
      sent,
      failed,
      message: `Emails sent: ${sent}, failed: ${failed}`,
      errors,
    });
  } catch (error) {
    console.error('Send users email error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}