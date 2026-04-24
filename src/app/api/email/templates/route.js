export const dynamic = 'force-dynamic';

import { userMatchesToken } from '@/lib/auth';
import { getUsers, getEmailTemplates, saveEmailTemplates } from '@/lib/gcs';
import { v4 as uuidv4 } from 'uuid';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => userMatchesToken(u, token)) || null;
}

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const templates = await getEmailTemplates();
    return Response.json({ templates });
  } catch (err) {
    console.error('Email templates GET error:', err);
    return Response.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { name, subject, body_html, merge_fields } = await request.json();
    if (!name || !subject) {
      return Response.json({ error: 'Name and subject are required' }, { status: 400 });
    }

    const templates = await getEmailTemplates();
    const template = {
      id: uuidv4(),
      name,
      subject,
      body_html: body_html || '',
      merge_fields: merge_fields || ['lead_name', 'event_name', 'event_date', 'event_location', 'company_name', 'rsvp_link'],
      created_by: user.full_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    templates.push(template);
    await saveEmailTemplates(templates);

    return Response.json({ template });
  } catch (err) {
    console.error('Email templates POST error:', err);
    return Response.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await authenticate(request);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { id, ...updates } = await request.json();
    const templates = await getEmailTemplates();
    const idx = templates.findIndex(t => t.id === id);
    if (idx === -1) return Response.json({ error: 'Template not found' }, { status: 404 });

    templates[idx] = { ...templates[idx], ...updates, updated_at: new Date().toISOString() };
    await saveEmailTemplates(templates);

    return Response.json({ template: templates[idx] });
  } catch (err) {
    console.error('Email templates PUT error:', err);
    return Response.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await authenticate(request);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await request.json();
    let templates = await getEmailTemplates();
    templates = templates.filter(t => t.id !== id);
    await saveEmailTemplates(templates);

    return Response.json({ success: true });
  } catch (err) {
    console.error('Email templates DELETE error:', err);
    return Response.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
