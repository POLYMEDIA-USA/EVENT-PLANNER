export const dynamic = 'force-dynamic';

import { userMatchesToken } from '@/lib/auth';
import { getUsers, getEvents, getCustomers, getInteractions, getEmailLogs } from '@/lib/gcs';

export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const users = await getUsers();
    const user = users.find(u => userMatchesToken(u, token));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [events, customers, interactions, emailLogs] = await Promise.all([
      getEvents(),
      getCustomers(),
      getInteractions(),
      getEmailLogs(),
    ]);

    // Scope data by org for non-admins
    const scopedCustomers = user.role === 'admin'
      ? customers
      : customers.filter(c => c.organization_id === user.organization_id);

    const possible = scopedCustomers.filter(c => c.status === 'possible').length;
    const approved = scopedCustomers.filter(c => c.status === 'approved').length;
    const invited = scopedCustomers.filter(c => c.status === 'invited').length;
    const accepted = scopedCustomers.filter(c => c.status === 'accepted').length;
    const declined = scopedCustomers.filter(c => c.status === 'declined').length;
    const attended = scopedCustomers.filter(c => c.status === 'attended').length;
    const total = scopedCustomers.length;

    // Lead score distribution
    const scoreDistribution = { hot: 0, warm: 0, cold: 0 };
    for (const c of scopedCustomers) {
      let score = 0;
      score += Math.min(interactions.filter(i => i.customer_id === c.id).length * 5, 25);
      score += Math.min(emailLogs.filter(e => e.to === c.email && e.status === 'sent').length * 5, 15);
      if (c.status === 'accepted') score += 20;
      if (c.status === 'attended') score += 30;
      if (c.assigned_rep_id) score += 5;
      if (score >= 50) scoreDistribution.hot++;
      else if (score >= 20) scoreDistribution.warm++;
      else scoreDistribution.cold++;
    }

    return Response.json({
      events: events.filter(e => e.status === 'active').length,
      leads: possible,
      invited: invited + accepted,
      attended,
      total_interactions: user.role === 'admin'
        ? interactions.length
        : interactions.filter(i => i.sales_rep_id === user.id).length,
      pipeline: { possible, approved, invited, accepted, declined, attended, total },
      scoreDistribution,
    });
  } catch (err) {
    console.error('Stats error:', err);
    return Response.json({ events: 0, leads: 0, invited: 0, attended: 0, total_interactions: 0 });
  }
}
