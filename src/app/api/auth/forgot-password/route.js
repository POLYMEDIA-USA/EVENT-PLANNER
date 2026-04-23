export const dynamic = 'force-dynamic';

import { getUsers, saveUsers, getSettings } from '@/lib/gcs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const users = await getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    // Always return success to avoid revealing whether email exists
    if (!user) {
      return Response.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Generate reset token (16 bytes, base64url) with 1-hour expiry
    const resetToken = crypto.randomBytes(16).toString('base64url');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    user.reset_token = resetToken;
    user.reset_token_expires = resetExpires;
    await saveUsers(users);

    // Send reset email via SMTP
    const settings = await getSettings();
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      console.error('SMTP not configured — cannot send password reset email');
      return Response.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port) || 587,
      secure: parseInt(settings.smtp_port) === 465,
      auth: { user: settings.smtp_user, pass: settings.smtp_pass },
    });

    const baseUrl = settings.app_url || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    const fromAddress = settings.smtp_from || settings.smtp_user;
    const companyName = settings.company_name || 'FunnelFlow';
    const logoUrl = settings.company_logo_url || '';
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:60px;margin-bottom:16px;" />` : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  ${logoHtml}
  <h2 style="color:#4F46E5;">Password Reset</h2>
  <p>Hi ${user.full_name},</p>
  <p>We received a request to reset your password. Click the button below to set a new password:</p>
  <div style="margin:24px 0;">
    <a href="${resetUrl}" style="display:inline-block;padding:12px 32px;background:#4F46E5;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a>
  </div>
  <p style="color:#6B7280;font-size:14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  <p style="color:#9CA3AF;font-size:12px;margin-top:32px;">Sent by ${companyName} via FunnelFlow</p>
</body></html>`;

    try {
      await transporter.sendMail({
        from: `"${companyName}" <${fromAddress}>`,
        to: user.email,
        subject: `Password Reset - ${companyName}`,
        html,
      });
    } catch (err) {
      console.error('Failed to send reset email:', err.message);
    }

    return Response.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
