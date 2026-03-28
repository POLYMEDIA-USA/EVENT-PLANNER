export const dynamic = 'force-dynamic';

import { getUsers, getCustomers, saveCustomers } from '@/lib/gcs';
import { generateRSVPToken } from '@/lib/auth';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

// GET - fetch invited customers
export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const customers = await getCustomers();
    let invited = customers.filter(c => ['approved', 'invited', 'accepted', 'declined', 'attended'].includes(c.status));

    // Sales reps only see invited leads assigned to them
    if (user.role === 'sales_rep') {
      invited = invited.filter(c => c.assigned_rep_id === user.id);
    }

    return Response.json({ customers: invited });
  } catch (err) {
    console.error('Invited GET error:', err);
    return Response.json({ error: 'Failed to fetch invited' }, { status: 500 });
  }
}

// POST - prepare approved leads with RSVP tokens (does NOT change status to invited;
//         status changes to "invited" only when an email is actually sent)
export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'supervisor') return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });

    const { customer_ids } = await request.json();
    if (!customer_ids || !customer_ids.length) {
      return Response.json({ error: 'No customers selected' }, { status: 400 });
    }

    const customers = await getCustomers();
    let prepared = 0;

    for (const id of customer_ids) {
      const idx = customers.findIndex(c => c.id === id);
      if (idx !== -1 && customers[idx].status === 'approved') {
        // Generate RSVP token but keep status as "approved" until email is sent
        if (!customers[idx].rsvp_token) {
          customers[idx].rsvp_token = generateRSVPToken();
        }
        customers[idx].approved_to_invite_at = new Date().toISOString();
        prepared++;
      }
    }

    await saveCustomers(customers);
    return Response.json({ prepared, total: customer_ids.length });
  } catch (err) {
    console.error('Invite POST error:', err);
    return Response.json({ error: 'Failed to prepare leads' }, { status: 500 });
  }
}
