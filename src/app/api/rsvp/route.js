export const dynamic = 'force-dynamic';

import { getCustomers, saveCustomers, getInteractions, saveInteractions, getEventAssignments } from '@/lib/gcs';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const action = searchParams.get('action');

    if (!token || !action) {
      return Response.json({ error: 'Invalid RSVP link' }, { status: 400 });
    }

    const customers = await getCustomers();
    const idx = customers.findIndex(c => c.rsvp_token === token);

    if (idx === -1) {
      return Response.json({ error: 'Invalid or expired RSVP token' }, { status: 404 });
    }

    const customer = customers[idx];

    // Lock RSVP after first response — prevent re-clicking
    if (customer.rsvp_responded_at) {
      return Response.json({
        status: customer.status,
        customer_name: customer.full_name,
        qr_code_data: customer.qr_code_data || null,
        already_responded: true,
      });
    }

    if (action === 'accept') {
      customers[idx].status = 'accepted';
      customers[idx].rsvp_responded_at = new Date().toISOString();
      // Generate short 4-char alphanumeric check-in code (uppercase)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
      let code;
      do {
        code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      } while (customers.some(c => c.qr_code_data === code));
      customers[idx].qr_code_data = code;
    } else if (action === 'decline') {
      customers[idx].status = 'declined';
      customers[idx].rsvp_responded_at = new Date().toISOString();
      // Clear QR code on decline so stale check-in codes don't persist
      customers[idx].qr_code_data = null;
    }

    await saveCustomers(customers);

    // Log interaction
    const interactions = await getInteractions();
    interactions.push({
      id: uuidv4(),
      customer_id: customer.id,
      interaction_type: action === 'accept' ? 'rsvp_accept' : 'rsvp_decline',
      notes: `Customer ${action === 'accept' ? 'accepted' : 'declined'} the invitation`,
      created_at: new Date().toISOString(),
    });
    await saveInteractions(interactions);

    // Look up event_id for this customer
    const assignments = await getEventAssignments();
    const assignment = assignments.find(a => a.customer_id === customer.id);
    const event_id = assignment ? assignment.event_id : null;

    return Response.json({
      status: action === 'accept' ? 'accepted' : 'declined',
      customer_name: customer.full_name,
      qr_code_data: action === 'accept' ? customers[idx].qr_code_data : null,
      event_id,
    });
  } catch (err) {
    console.error('RSVP error:', err);
    return Response.json({ error: 'RSVP processing failed' }, { status: 500 });
  }
}
