export const dynamic = 'force-dynamic';

import { getCustomers, saveCustomers, getEventAssignments, saveEventAssignments, getUsers } from '@/lib/gcs';
import { userMatchesToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => userMatchesToken(u, token)) || null;
}

// Realistic SPD/healthcare names so trainees see plausible data while practicing.
// .test TLD is reserved by RFC 6761 — emails will never deliver, perfect for sandbox use.
const FIRST_NAMES = [
  'Alex','Jordan','Taylor','Morgan','Casey','Reese','Avery','Quinn','Skyler','Drew',
  'Bailey','Cameron','Dakota','Elliot','Finley','Harper','Hayden','Jamie','Kendall','Logan',
  'Marin','Nico','Parker','Riley','Rowan','Sage','Shay','Sloan','Tatum','Wren',
  'Aisha','Bea','Carmen','Dani','Esme','Fern','Gigi','Hana','Ines','June',
  'Kira','Lola','Mara','Nadia','Opal','Pia','Quinn','Rae','Sana','Tess'
];

const LAST_NAMES = [
  'Andrews','Beck','Carlson','Diaz','Ellis','Foster','Greene','Hammond','Iverson','Jackson',
  'Knox','Larson','Mendez','Nguyen','Ortiz','Patel','Quinones','Reyes','Singh','Thompson',
  'Underwood','Vargas','Walsh','Xiong','Young','Zimmerman','Bishop','Cohen','Dawson','Esposito',
  'Fields','Garcia','Holt','Ito','Jensen','Kapoor','Lambert','Murphy','Navarro','Oduya',
  'Park','Quiroga','Russo','Sutton','Tanaka','Ulibarri','Vance','Webb','Yamamoto','Zheng'
];

const COMPANIES = [
  'Trainingco Memorial Hospital','Practice Medical Center','Sample Surgical Services',
  'Demo Health System','Mock Children\'s Hospital','Test ASC Network',
  'Sandbox Regional Medical','Roleplay Health Partners','Workshop SPD Group',
  'Lab Surgical Center','Example Cardiac Institute','Tutorial Orthopedic Hospital'
];

const TITLES = [
  'SPD Technician','SPD Lead','SPD Manager','SPD Director',
  'Sterile Processing Coordinator','Surgical Services Director','OR Manager',
  'Biomed Technician','Biomed Manager','Quality Assurance Specialist',
  'Infection Prevention Lead','Endoscopy Coordinator','Materials Manager'
];

const SOURCES = ['Trade Show','Referral','Website','Social Media','Manual'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// POST /api/training/generate-leads
// Body: { count: number, event_id?: string }
// Admin-only. Creates `count` dummy leads with status='possible' and attaches them
// to the event if event_id is provided. Emails use the .test TLD (RFC 6761) so they
// never deliver to real mailboxes. Source is set to "Manual" or one of the realistic
// sources so reports look plausible.
export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { count = 10, event_id } = await request.json();
    if (typeof count !== 'number' || count < 1 || count > 100) {
      return Response.json({ error: 'count must be between 1 and 100' }, { status: 400 });
    }

    const customers = await getCustomers();
    const now = new Date().toISOString();
    const created = [];

    // Track emails used in this batch so we don't generate duplicates within the same call
    const usedEmails = new Set(customers.map(c => (c.email || '').toLowerCase()));

    for (let i = 0; i < count; i++) {
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const company = pick(COMPANIES);
      const title = pick(TITLES);
      const source = pick(SOURCES);

      // Build a unique email
      let suffix = 0;
      let email;
      do {
        email = suffix === 0
          ? `${first}.${last}@trainingco.test`.toLowerCase()
          : `${first}.${last}${suffix}@trainingco.test`.toLowerCase();
        suffix++;
      } while (usedEmails.has(email) && suffix < 100);
      usedEmails.add(email);

      const lead = {
        id: uuidv4(),
        full_name: `${first} ${last}`,
        title,
        company_name: company,
        email,
        phone: '',
        alt_email: '',
        input_by: user.full_name,
        input_by_org: user.organization_name || '',
        added_by_user_id: user.id,
        added_by_name: user.full_name,
        assigned_rep_id: '',
        assigned_rep_name: '',
        assigned_rep_org: '',
        organization_id: user.organization_id || '',
        organization_name: user.organization_name || '',
        notes: '[Training data — generated automatically. Safe to delete or reset.]',
        source,
        status: 'possible',
        rsvp_token: '',
        qr_code_data: '',
        is_training: true, // hint for any future report-filtering work
        created_at: now,
      };
      customers.push(lead);
      created.push(lead);
    }

    await saveCustomers(customers);

    if (event_id) {
      const assignments = await getEventAssignments();
      created.forEach(lead => {
        assignments.push({ id: uuidv4(), event_id, customer_id: lead.id });
      });
      await saveEventAssignments(assignments);
    }

    return Response.json({
      created: created.length,
      message: `Generated ${created.length} training lead${created.length !== 1 ? 's' : ''}${event_id ? ' and attached them to the selected event' : ''}.`,
    });
  } catch (err) {
    console.error('Generate training leads error:', err);
    return Response.json({ error: 'Failed: ' + err.message }, { status: 500 });
  }
}
