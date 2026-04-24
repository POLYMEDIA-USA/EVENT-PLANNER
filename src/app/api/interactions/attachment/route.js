export const dynamic = 'force-dynamic';

import { userMatchesToken } from '@/lib/auth';
import { getUsers } from '@/lib/gcs';
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET || 'event-planner-bucket';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => userMatchesToken(u, token)) || null;
}

// GET — generate a fresh signed URL for an attachment
export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const gcsPath = searchParams.get('path');
    if (!gcsPath || !gcsPath.startsWith('attachments/')) {
      return Response.json({ error: 'Invalid path' }, { status: 400 });
    }

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(gcsPath);
    const [exists] = await file.exists();
    if (!exists) return Response.json({ error: 'File not found' }, { status: 404 });

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return Response.json({ url: signedUrl });
  } catch (err) {
    console.error('Attachment error:', err);
    return Response.json({ error: 'Failed to get attachment' }, { status: 500 });
  }
}
