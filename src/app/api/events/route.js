export const dynamic = 'force-dynamic';

import { userMatchesToken } from '@/lib/auth';
import { getEvents, saveEvents, getUsers } from '@/lib/gcs';
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
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const events = await getEvents();
    return Response.json({ events });
  } catch (err) {
    console.error('Events GET error:', err);
    return Response.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { name, event_date, event_time, location, description } = await request.json();
    if (!name || !event_date || !event_time || !location) {
      return Response.json({ error: 'Name, date, time, and location are required' }, { status: 400 });
    }

    const events = await getEvents();
    const event = {
      id: uuidv4(),
      name,
      event_date,
      event_time,
      location,
      description: description || '',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    events.push(event);
    await saveEvents(events);

    return Response.json({ event });
  } catch (err) {
    console.error('Events POST error:', err);
    return Response.json({ error: 'Failed to create event' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { id, ...updates } = await request.json();
    const events = await getEvents();
    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) return Response.json({ error: 'Event not found' }, { status: 404 });

    events[idx] = { ...events[idx], ...updates, updated_at: new Date().toISOString() };
    await saveEvents(events);

    return Response.json({ event: events[idx] });
  } catch (err) {
    console.error('Events PUT error:', err);
    return Response.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await request.json();
    let events = await getEvents();
    events = events.filter(e => e.id !== id);
    await saveEvents(events);

    return Response.json({ success: true });
  } catch (err) {
    console.error('Events DELETE error:', err);
    return Response.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
