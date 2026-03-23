import { NextResponse } from 'next/server';
import { listFiles, readText } from '../../../lib/gcs';
import { verifyToken } from '../../../lib/auth';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'list') {
      const files = await listFiles();
      return NextResponse.json({ files });
    }

    // For read, require auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const filename = url.searchParams.get('file');

    if (action === 'read' && filename) {
      const content = await readText(filename);
      if (content === null) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      return new NextResponse(content, {
        headers: { 'Content-Type': 'text/plain' },
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('GCS API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}