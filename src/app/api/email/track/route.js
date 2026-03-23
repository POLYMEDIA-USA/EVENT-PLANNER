export const dynamic = 'force-dynamic';

import { readJSON, writeJSON } from '@/lib/gcs';

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const url = searchParams.get('url');

    if (!type || !id) {
      return new Response('Missing parameters', { status: 400 });
    }

    const emailLogs = await readJSON('email_logs.json');
    const idx = emailLogs.findIndex(e => e.id === id);

    if (idx !== -1) {
      if (type === 'open' && !emailLogs[idx].opened_at) {
        emailLogs[idx].opened_at = new Date().toISOString();
        await writeJSON('email_logs.json', emailLogs);
      } else if (type === 'click') {
        emailLogs[idx].clicked_at = new Date().toISOString();
        await writeJSON('email_logs.json', emailLogs);
      }
    }

    if (type === 'click' && url) {
      return Response.redirect(url, 302);
    }

    // Return tracking pixel
    return new Response(TRANSPARENT_GIF, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (err) {
    console.error('Email track error:', err);
    return new Response(TRANSPARENT_GIF, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' },
    });
  }
}
