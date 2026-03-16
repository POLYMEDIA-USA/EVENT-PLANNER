export const dynamic = 'force-dynamic';

import { getCustomers, saveCustomers, getInteractions, saveInteractions } from '@/lib/gcs';
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

    if (action === 'accept') {
      customers[idx].status = 'accepted';
      customers[idx].rsvp_responded_at = new Date().toISOString();
      // Generate QR code data (the token itself serves as QR data)
      customers[idx].qr_code_data = `CORPMARKETER:${customer.id}:${token}`;
    } else if (action === 'decline') {
      customers[idx].status = 'declined';
      customers[idx].rsvp_responded_at = new Date().toISOString();
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

    return Response.json({
      status: action === 'accept' ? 'accepted' : 'declined',
      customer_name: customer.full_name,
      qr_code_data: action === 'accept' ? customers[idx].qr_code_data : null,
    });
  } catch (err) {
    console.error('RSVP error:', err);
    return Response.json({ error: 'RSVP processing failed' }, { status: 500 });
  }
}
