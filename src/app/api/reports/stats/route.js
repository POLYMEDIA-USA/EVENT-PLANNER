export const dynamic = 'force-dynamic';

import { getUsers, getEvents, getCustomers, getInteractions } from '@/lib/gcs';

export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const users = await getUsers();
    const user = users.find(u => u.session_token === token);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [events, customers, interactions] = await Promise.all([
      getEvents(),
      getCustomers(),
      getInteractions(),
    ]);

    // Scope data by org for non-admins
    const scopedCustomers = user.role === 'admin'
      ? customers
      : customers.filter(c => c.organization_id === user.organization_id);

    return Response.json({
      events: events.filter(e => e.status === 'active').length,
      leads: scopedCustomers.filter(c => c.status === 'possible').length,
      invited: scopedCustomers.filter(c => c.status === 'invited' || c.status === 'accepted').length,
      attended: scopedCustomers.filter(c => c.status === 'attended').length,
      total_interactions: user.role === 'admin'
        ? interactions.length
        : interactions.filter(i => i.sales_rep_id === user.id).length,
    });
  } catch (err) {
    console.error('Stats error:', err);
    return Response.json({ events: 0, leads: 0, invited: 0, attended: 0, total_interactions: 0 });
  }
}
