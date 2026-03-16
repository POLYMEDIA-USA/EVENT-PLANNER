export const dynamic = 'force-dynamic';

import { getUsers, getCustomers, saveCustomers, getInteractions, saveInteractions } from '@/lib/gcs';
import { v4 as uuidv4 } from 'uuid';

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

    let interactions = await getInteractions();

    // Non-admins only see their own interactions
    if (user.role !== 'admin') {
      interactions = interactions.filter(i => i.sales_rep_id === user.id);
    }

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

    const { customer_id, event_id, notes, interaction_type, qr_data } = await request.json();

    // If QR scan, find customer by QR data
    let resolvedCustomerId = customer_id;
    if (qr_data && !customer_id) {
      const customers = await getCustomers();
      const customer = customers.find(c => c.qr_code_data === qr_data);
      if (!customer) return Response.json({ error: 'Invalid QR code' }, { status: 404 });
      resolvedCustomerId = customer.id;

      // Mark as attended
      const idx = customers.findIndex(c => c.id === customer.id);
      if (idx !== -1) {
        customers[idx].status = 'attended';
        customers[idx].attended_at = new Date().toISOString();
        await saveCustomers(customers);
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
      created_at: new Date().toISOString(),
    };

    interactions.push(interaction);
    await saveInteractions(interactions);

    return Response.json({ interaction });
  } catch (err) {
    console.error('Interactions POST error:', err);
    return Response.json({ error: 'Failed to log interaction' }, { status: 500 });
  }
}
