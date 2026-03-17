export const dynamic = 'force-dynamic';

import { getUsers, getEmailLogs } from '@/lib/gcs';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'supervisor') return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const emailId = searchParams.get('email_id');

    let logs = await getEmailLogs();

    // Return single email by ID (for PDF viewer)
    if (emailId) {
      const email = logs.find(e => e.id === emailId);
      if (!email) return Response.json({ error: 'Email not found' }, { status: 404 });
      return Response.json({ email });
    }

    // Filter by customer
    if (customerId) {
      logs = logs.filter(e => e.customer_id === customerId);
    }

    // Sort newest first, strip html_body for list view
    const summary = logs
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(({ html_body, ...rest }) => rest);

    return Response.json({ emails: summary });
  } catch (err) {
    console.error('Email log error:', err);
    return Response.json({ error: 'Failed to fetch email logs' }, { status: 500 });
  }
}
