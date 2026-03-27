export const dynamic = 'force-dynamic';

import { getUsers, getCustomers, saveCustomers, getEventAssignments, saveEventAssignments, getInteractions, getEmailLogs } from '@/lib/gcs';
import { v4 as uuidv4 } from 'uuid';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

/** Fuzzy org name matching (same logic as /api/reps) */
function normalizeOrg(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
    .replace(/\binc\.?\b/g, '').replace(/\bcorp\.?\b/g, '')
    .replace(/\bllc\.?\b/g, '').replace(/\bltd\.?\b/g, '')
    .replace(/\bco\.?\b/g, '').replace(/[.,]/g, '').trim();
}
function orgMatches(orgA, orgB) {
  const a = normalizeOrg(orgA), b = normalizeOrg(orgB);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    let customers = await getCustomers();

    // Visibility rules:
    // Admin: sees ALL leads
    // Supervisor: sees unassigned leads + leads assigned to reps in their org
    // Sales rep: sees leads they input + leads assigned to them
    if (user.role === 'sales_rep') {
      customers = customers.filter(c =>
        c.assigned_rep_id === user.id ||
        c.added_by_user_id === user.id
      );
    } else if (user.role === 'supervisor') {
      customers = customers.filter(c =>
        // Unassigned leads (available for supervisor to assign)
        !c.assigned_rep_id ||
        // Leads assigned to reps in supervisor's org
        c.organization_id === user.organization_id ||
        orgMatches(c.assigned_rep_org, user.organization_name)
      );
    }
    // Admin: no filter — sees everything

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

    // Auto-assign: when a sales rep creates a lead, assign it to themselves
    let finalRepId = assigned_rep_id || '';
    let finalRepName = assigned_rep_name || '';
    let finalRepOrg = assigned_rep_org || '';
    if (user.role === 'sales_rep' && !finalRepId) {
      finalRepId = user.id;
      finalRepName = user.full_name;
      finalRepOrg = user.organization_name;
    }

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
      assigned_rep_id: finalRepId,
      assigned_rep_name: finalRepName,
      assigned_rep_org: finalRepOrg,
      organization_id: user.organization_id,
      organization_name: user.organization_name,
      notes: notes || '',
      source: source || 'Manual',
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

    // Permission check:
    // Admin: can edit any lead
    // Supervisor: can edit leads they created, or leads assigned to/created by reps in their org
    // Sales rep: can edit leads assigned to them or created by them
    const lead = customers[idx];
    if (user.role === 'sales_rep') {
      if (lead.assigned_rep_id !== user.id && lead.added_by_user_id !== user.id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (user.role === 'supervisor') {
      const isOwnLead = lead.added_by_user_id === user.id;
      const isOrgLead = lead.organization_id === user.organization_id || orgMatches(lead.assigned_rep_org, user.organization_name);
      const isUnassigned = !lead.assigned_rep_id;
      if (!isOwnLead && !isOrgLead && !isUnassigned) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    // Admin: no restriction

    const { added_by_user_id, added_by_name, organization_id, organization_name, input_by, input_by_org, ...safeUpdates } = updates;
    customers[idx] = { ...customers[idx], ...safeUpdates, updated_at: new Date().toISOString() };

    // When a rep is assigned, update the lead's org to match the rep
    // so the sales rep can see the lead in their org-filtered view
    if (safeUpdates.assigned_rep_id && safeUpdates.assigned_rep_org) {
      const allUsers = await getUsers();
      const assignedRep = allUsers.find(u => u.id === safeUpdates.assigned_rep_id);
      if (assignedRep) {
        customers[idx].organization_id = assignedRep.organization_id;
        customers[idx].organization_name = assignedRep.organization_name;
      }
    }

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
    // Same permission logic as PUT
    if (user.role === 'sales_rep') {
      if (customer.assigned_rep_id !== user.id && customer.added_by_user_id !== user.id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (user.role === 'supervisor') {
      const isOwnLead = customer.added_by_user_id === user.id;
      const isOrgLead = customer.organization_id === user.organization_id || orgMatches(customer.assigned_rep_org, user.organization_name);
      const isUnassigned = !customer.assigned_rep_id;
      if (!isOwnLead && !isOrgLead && !isUnassigned) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
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
