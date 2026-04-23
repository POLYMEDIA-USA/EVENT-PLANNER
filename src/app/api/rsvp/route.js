export const dynamic = 'force-dynamic';

import { getCustomers, saveCustomers, getInteractions, saveInteractions, getEventAssignments, getTeamAttendance } from '@/lib/gcs';
import { generateUniqueQRCode } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// GET — no longer processes RSVP; just returns status so scanners can't trigger actions
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

  const customers = await getCustomers();
  const customer = customers.find(c => c.rsvp_token === token);
  if (!customer) return Response.json({ error: 'Invalid or expired RSVP token' }, { status: 404 });

  return Response.json({ valid: true, customer_name: customer.full_name });
}

// POST — actual RSVP processing (only triggered by human clicking the confirm button)
export async function POST(request) {
  try {
    const { token, action } = await request.json();

    if (!token || !action) {
      return Response.json({ error: 'Invalid RSVP request' }, { status: 400 });
    }

    const customers = await getCustomers();
    const idx = customers.findIndex(c => c.rsvp_token === token);

    if (idx === -1) {
      return Response.json({ error: 'Invalid or expired RSVP token' }, { status: 404 });
    }

    const customer = customers[idx];

    // Lock RSVP after first response
    if (customer.rsvp_responded_at) {
      return Response.json({
        status: customer.status,
        customer_name: customer.full_name,
        qr_code_data: customer.qr_code_data || null,
        already_responded: true,
      });
    }

    if (action === 'accept') {
      customers[idx].status = 'accepted';
      customers[idx].rsvp_responded_at = new Date().toISOString();
      // Mint a QR that doesn't collide with any existing customer OR team-attendance code
      const teamAttendance = await getTeamAttendance();
      customers[idx].qr_code_data = generateUniqueQRCode(customers, teamAttendance);
    } else if (action === 'decline') {
      customers[idx].status = 'declined';
      customers[idx].rsvp_responded_at = new Date().toISOString();
      customers[idx].qr_code_data = null;
    }

    await saveCustomers(customers);

    // Log interaction
    const interactions = await getInteractions();
    interactions.push({
      id: uuidv4(),
      customer_id: customer.id,
      interaction_type: action === 'accept' ? 'rsvp_accept' : 'rsvp_decline',
      notes: `Customer ${action === 'accept' ? 'accepted' : 'declined'} the invitation`,
      created_at: new Date().toISOString(),
    });
    await saveInteractions(interactions);

    const assignments = await getEventAssignments();
    const assignment = assignments.find(a => a.customer_id === customer.id);
    const event_id = assignment ? assignment.event_id : null;

    return Response.json({
      status: action === 'accept' ? 'accepted' : 'declined',
      customer_name: customer.full_name,
      qr_code_data: action === 'accept' ? customers[idx].qr_code_data : null,
      event_id,
    });
  } catch (err) {
    console.error('RSVP error:', err);
    return Response.json({ error: 'RSVP processing failed' }, { status: 500 });
  }
}
