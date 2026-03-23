export const dynamic = 'force-dynamic';

import { getUsers, getCustomers, getSettings } from '@/lib/gcs';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });
    }

    const { customer_ids, message } = await request.json();
    if (!customer_ids || !customer_ids.length) {
      return Response.json({ error: 'No customers selected' }, { status: 400 });
    }
    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings.vonage_api_key || !settings.vonage_api_secret || !settings.vonage_from_number) {
      return Response.json({ error: 'Vonage SMS not configured. Go to Settings and enter Vonage API key, secret, and from number.' }, { status: 400 });
    }

    const customers = await getCustomers();
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const id of customer_ids) {
      const customer = customers.find(c => c.id === id);
      if (!customer || !customer.phone) {
        failed++;
        errors.push(`${customer?.full_name || id}: No phone number`);
        continue;
      }

      // Clean phone number - remove non-digits except leading +
      const phone = customer.phone.replace(/[^\d+]/g, '');

      try {
        const res = await fetch('https://rest.nexmo.com/sms/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: settings.vonage_api_key,
            api_secret: settings.vonage_api_secret,
            from: settings.vonage_from_number,
            to: phone,
            text: message,
          }),
        });

        const data = await res.json();
        const msg = data.messages?.[0];
        if (msg && msg.status === '0') {
          sent++;
        } else {
          failed++;
          errors.push(`${customer.full_name}: ${msg?.['error-text'] || 'Unknown error'}`);
        }
      } catch (err) {
        failed++;
        errors.push(`${customer.full_name}: ${err.message}`);
      }
    }

    return Response.json({ sent, failed, errors });
  } catch (err) {
    console.error('SMS send error:', err);
    return Response.json({ error: 'Failed to send SMS: ' + err.message }, { status: 500 });
  }
}
