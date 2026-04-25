export const dynamic = 'force-dynamic';

import { userMatchesToken } from '@/lib/auth';
import { getUsers, getEmailLogs, getCustomers } from '@/lib/gcs';

function normalizeOrg(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
    .replace(/\binc\.?\b/g, '').replace(/\bcorp\.?\b/g, '')
    .replace(/\bllc\.?\b/g, '').replace(/\bltd\.?\b/g, '')
    .replace(/\bco\.?\b/g, '').replace(/[.,]/g, '').trim();
}
function orgMatches(a, b) {
  const x = normalizeOrg(a), y = normalizeOrg(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

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
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const emailId = searchParams.get('email_id');

    let logs = await getEmailLogs();

    // Build the set of customer IDs this user is allowed to see email for
    let visibleCustomerIds = null; // null = no restriction (admin)
    if (user.role === 'supervisor' || user.role === 'sales_rep') {
      const customers = await getCustomers();
      const visible = customers.filter(c => {
        if (user.role === 'sales_rep') {
          return c.assigned_rep_id === user.id || c.added_by_user_id === user.id;
        }
        // supervisor: org match or unassigned
        return !c.assigned_rep_id ||
          c.organization_id === user.organization_id ||
          orgMatches(c.assigned_rep_org, user.organization_name);
      });
      visibleCustomerIds = new Set(visible.map(c => c.id));
    }

    // Return single email by ID (for PDF viewer)
    if (emailId) {
      const email = logs.find(e => e.id === emailId);
      if (!email) return Response.json({ error: 'Email not found' }, { status: 404 });
      if (visibleCustomerIds) {
        const isTeamEmail = (email.type || '').startsWith('team_');
        const allowed = visibleCustomerIds.has(email.customer_id)
          || (user.role === 'supervisor' && isTeamEmail);
        if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      return Response.json({ email });
    }

    // Filter by customer
    if (customerId) {
      logs = logs.filter(e => e.customer_id === customerId);
    }

    // Scope to visible customers for non-admins.
    // Team-side emails (team_invite / team_confirmation / team_custom / team_template:*)
    // have customer_id='' since they're not tied to a lead — supervisors should still see
    // them so the Team page can render an Emails Sent column. Sales reps are not exposed
    // to team emails (they don't manage staff attendance).
    if (visibleCustomerIds) {
      logs = logs.filter(e => {
        if (visibleCustomerIds.has(e.customer_id)) return true;
        if (user.role === 'supervisor' && (e.type || '').startsWith('team_')) return true;
        return false;
      });
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
