export const dynamic = 'force-dynamic';

import { getEvents } from '@/lib/gcs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
      return Response.json({ error: 'event_id is required' }, { status: 400 });
    }

    const events = await getEvents();
    const event = events.find(e => e.id === eventId);

    if (!event) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    // Build date/time in iCal format (YYYYMMDDTHHMMSS)
    const dateStr = (event.event_date || '').replace(/-/g, '');
    const timeStr = (event.event_time || '00:00').replace(/:/g, '') + '00';
    const dtStart = `${dateStr}T${timeStr}`;

    // Default 2-hour event duration
    const startHour = parseInt((event.event_time || '00:00').split(':')[0], 10);
    const startMin = parseInt((event.event_time || '00:00').split(':')[1], 10);
    const endHour = startHour + 2;
    const endTimeStr = String(endHour).padStart(2, '0') + String(startMin).padStart(2, '0') + '00';
    const dtEnd = `${dateStr}T${endTimeStr}`;

    const now = new Date();
    const dtStamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    // Escape special characters for iCal
    const escapeIcal = (str) => (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CorpMarketer//Event//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.id}@corpmarketer`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcal(event.name)}`,
      `LOCATION:${escapeIcal(event.location || '')}`,
      `DESCRIPTION:${escapeIcal(event.description || '')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const filename = `${event.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('iCal export error:', err);
    return Response.json({ error: 'Failed to generate calendar file' }, { status: 500 });
  }
}
