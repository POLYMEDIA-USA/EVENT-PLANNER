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
    if (user.role !== 'admin' && user.role !== 'supervisor') return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });

    const customers = await getCustomers();
    const invited = customers.filter(c => ['invited', 'accepted', 'declined', 'attended'].includes(c.status));
    return Response.json({ customers: invited });
  } catch (err) {
    console.error('Invited GET error:', err);
    return Response.json({ error: 'Failed to fetch invited' }, { status: 500 });
  }
}

// POST - promote leads to invited status
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
    let promoted = 0;

    for (const id of customer_ids) {
      const idx = customers.findIndex(c => c.id === id);
      if (idx !== -1 && customers[idx].status === 'possible') {
        customers[idx].status = 'invited';
        customers[idx].rsvp_token = generateRSVPToken();
        customers[idx].invited_at = new Date().toISOString();
        promoted++;
      }
    }

    await saveCustomers(customers);
    return Response.json({ promoted, total: customer_ids.length });
  } catch (err) {
    console.error('Invite POST error:', err);
    return Response.json({ error: 'Failed to promote leads' }, { status: 500 });
  }
}
