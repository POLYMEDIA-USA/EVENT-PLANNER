export const dynamic = 'force-dynamic';

import { userMatchesToken } from '@/lib/auth';
import { getUsers, getCustomers, saveCustomers, getInteractions, saveInteractions, getTeamAttendance, saveTeamAttendance } from '@/lib/gcs';
import { v4 as uuidv4 } from 'uuid';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => userMatchesToken(u, token)) || null;
}

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let interactions = await getInteractions();

    // Non-admins only see their own interactions
    if (user.role !== 'admin' && user.role !== 'supervisor') {
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

        // Mark as attended
        const idx = customers.findIndex(c => c.id === customer.id);
        if (idx !== -1) {
          customers[idx].status = 'attended';
          customers[idx].attended_at = new Date().toISOString();
          await saveCustomers(customers);
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

      // If this is a check-in (qr_scan type) by customer ID, also mark as attended
      if (interaction_type === 'qr_scan' && resolvedCustomer) {
        const idx = customers.findIndex(c => c.id === resolvedCustomerId);
        if (idx !== -1 && customers[idx].status !== 'attended') {
          customers[idx].status = 'attended';
          customers[idx].attended_at = new Date().toISOString();
          await saveCustomers(customers);
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
