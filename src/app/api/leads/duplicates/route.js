export const dynamic = 'force-dynamic';

import { getUsers, getCustomers, saveCustomers, getEventAssignments, saveEventAssignments, getInteractions, saveInteractions } from '@/lib/gcs';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });
    }

    const customers = await getCustomers();

    // Find exact duplicates by email (case-insensitive)
    const emailMap = {};
    for (const c of customers) {
      if (!c.email) continue;
      const key = c.email.toLowerCase();
      if (!emailMap[key]) emailMap[key] = [];
      emailMap[key].push(c);
    }
    const exact = Object.values(emailMap).filter(group => group.length > 1);

    // Find possible duplicates by full_name + company_name (case-insensitive)
    const nameMap = {};
    for (const c of customers) {
      if (!c.full_name) continue;
      const key = `${c.full_name.toLowerCase()}|${(c.company_name || '').toLowerCase()}`;
      if (!nameMap[key]) nameMap[key] = [];
      nameMap[key].push(c);
    }
    // Exclude groups that are already caught by exact email match
    const exactIds = new Set(exact.flat().map(c => c.id));
    const possible = Object.values(nameMap).filter(group => {
      if (group.length <= 1) return false;
      // Only include if not all members are already in an exact duplicate group
      const allInExact = group.every(c => exactIds.has(c.id));
      return !allInExact;
    });

    return Response.json({ exact, possible });
  } catch (err) {
    console.error('Duplicates GET error:', err);
    return Response.json({ error: 'Failed to find duplicates' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return Response.json({ error: 'Admin/Supervisor only' }, { status: 403 });
    }

    const { keep_id, merge_ids } = await request.json();
    if (!keep_id || !merge_ids || !merge_ids.length) {
      return Response.json({ error: 'keep_id and merge_ids required' }, { status: 400 });
    }

    const mergeSet = new Set(merge_ids);

    // Move event_assignments from merged leads to kept lead
    let assignments = await getEventAssignments();
    assignments = assignments.map(a => {
      if (mergeSet.has(a.customer_id)) {
        return { ...a, customer_id: keep_id };
      }
      return a;
    });
    // Deduplicate assignments (same event_id + customer_id)
    const assignmentKeys = new Set();
    assignments = assignments.filter(a => {
      const key = `${a.event_id}|${a.customer_id}`;
      if (assignmentKeys.has(key)) return false;
      assignmentKeys.add(key);
      return true;
    });
    await saveEventAssignments(assignments);

    // Move interactions from merged leads to kept lead
    let interactions = await getInteractions();
    interactions = interactions.map(i => {
      if (mergeSet.has(i.customer_id)) {
        return { ...i, customer_id: keep_id };
      }
      return i;
    });
    await saveInteractions(interactions);

    // Remove merged leads
    let customers = await getCustomers();
    customers = customers.filter(c => !mergeSet.has(c.id));
    await saveCustomers(customers);

    return Response.json({ success: true, removed: merge_ids.length });
  } catch (err) {
    console.error('Duplicates POST error:', err);
    return Response.json({ error: 'Failed to merge leads' }, { status: 500 });
  }
}
