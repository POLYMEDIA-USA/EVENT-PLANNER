export const dynamic = 'force-dynamic';

import { getUsers, getCustomers, saveCustomers, getEventAssignments, saveEventAssignments, getInteractions, getEmailLogs } from '@/lib/gcs';
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

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    let customers = await getCustomers();

    // Org-level data silo: sales reps only see their org's customers
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      customers = customers.filter(c => c.organization_id === user.organization_id);
    }

    // Filter by event if specified
    if (eventId) {
      const assignments = await getEventAssignments();
      const eventCustomerIds = assignments.filter(a => a.event_id === eventId).map(a => a.customer_id);
      customers = customers.filter(c => eventCustomerIds.includes(c.id));
    }

    // Calculate lead scores
    const [interactions, emailLogs] = await Promise.all([getInteractions(), getEmailLogs()]);
    const scored = customers.map(c => {
      let score = 0;
      const intCount = interactions.filter(i => i.customer_id === c.id).length;
      score += Math.min(intCount * 5, 25);
      const emailCount = emailLogs.filter(e => e.to === c.email && e.status === 'sent').length;
      score += Math.min(emailCount * 5, 15);
      if (c.status === 'accepted') score += 20;
      if (c.status === 'attended') score += 30;
      if (c.assigned_rep_id) score += 5;
      const label = score >= 50 ? 'hot' : score >= 20 ? 'warm' : 'cold';
      return { ...c, lead_score: score, lead_score_label: label, interaction_count: intCount };
    });

    return Response.json({ customers: scored });
  } catch (err) {
    console.error('Leads GET error:', err);
    return Response.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { full_name, title, company_name, email, phone, alt_email, event_id, assigned_rep_id, assigned_rep_name, assigned_rep_org, notes, source } = await request.json();
    if (!full_name || !email) {
      return Response.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const customers = await getCustomers();
    const customer = {
      id: uuidv4(),
      full_name,
      title: title || '',
      company_name: company_name || '',
      email: email.toLowerCase(),
      phone: phone || '',
      alt_email: alt_email || '',
      input_by: user.full_name,
      input_by_org: user.organization_name,
      added_by_user_id: user.id,
      added_by_name: user.full_name,
      assigned_rep_id: assigned_rep_id || '',
      assigned_rep_name: assigned_rep_name || '',
      assigned_rep_org: assigned_rep_org || '',
      organization_id: user.organization_id,
      organization_name: user.organization_name,
      notes: notes || '',
      source: source || 'manual',
      status: 'possible',
      rsvp_token: '',
      qr_code_data: '',
      created_at: new Date().toISOString(),
    };

    customers.push(customer);
    await saveCustomers(customers);

    // Assign to event if specified
    if (event_id) {
      const assignments = await getEventAssignments();
      assignments.push({ id: uuidv4(), event_id, customer_id: customer.id });
      await saveEventAssignments(assignments);
    }

    // Audit log
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ user_id: user.id, user_name: user.full_name, action: 'lead_created', entity_type: 'lead', entity_id: customer.id, details: `Created lead "${customer.full_name}" (${customer.email})` });

    return Response.json({ customer });
  } catch (err) {
    console.error('Leads POST error:', err);
    return Response.json({ error: 'Failed to add lead' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, ...updates } = await request.json();
    const customers = await getCustomers();
    const idx = customers.findIndex(c => c.id === id);
    if (idx === -1) return Response.json({ error: 'Lead not found' }, { status: 404 });

    // Non-admins can only edit their org's customers
    if (user.role !== 'admin' && customers[idx].organization_id !== user.organization_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { added_by_user_id, added_by_name, organization_id, organization_name, input_by, input_by_org, ...safeUpdates } = updates;
    customers[idx] = { ...customers[idx], ...safeUpdates, updated_at: new Date().toISOString() };
    await saveCustomers(customers);

    // Audit log
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ user_id: user.id, user_name: user.full_name, action: 'lead_updated', entity_type: 'lead', entity_id: id, details: `Updated lead "${customers[idx].full_name}" — fields: ${Object.keys(safeUpdates).join(', ')}` });

    return Response.json({ customer: customers[idx] });
  } catch (err) {
    console.error('Leads PUT error:', err);
    return Response.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await request.json();
    let customers = await getCustomers();
    const customer = customers.find(c => c.id === id);

    if (!customer) return Response.json({ error: 'Lead not found' }, { status: 404 });
    if (user.role !== 'admin' && customer.organization_id !== user.organization_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    customers = customers.filter(c => c.id !== id);
    await saveCustomers(customers);

    // Clean up event assignments
    let assignments = await getEventAssignments();
    assignments = assignments.filter(a => a.customer_id !== id);
    await saveEventAssignments(assignments);

    // Audit log
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ user_id: user.id, user_name: user.full_name, action: 'lead_deleted', entity_type: 'lead', entity_id: id, details: `Deleted lead "${customer.full_name}" (${customer.email})` });

    return Response.json({ success: true });
  } catch (err) {
    console.error('Leads DELETE error:', err);
    return Response.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}
