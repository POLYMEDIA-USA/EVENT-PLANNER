export const dynamic = 'force-dynamic';

import { getUsers } from '@/lib/gcs';
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET || 'event-planner-bucket';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: 'Only images (JPG, PNG, GIF, WebP) and PDFs are allowed' }, { status: 400 });
    }

    // Max 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || (file.type.includes('pdf') ? 'pdf' : 'jpg');
    const timestamp = Date.now();
    const safeName = `attachments/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const bucket = storage.bucket(BUCKET_NAME);
    const gcsFile = bucket.file(safeName);
    await gcsFile.save(buffer, {
      contentType: file.type,
      metadata: {
        uploadedBy: user.id,
        originalName: file.name,
      },
    });

    // Generate a signed URL (valid for 7 days) or use public URL
    const [signedUrl] = await gcsFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return Response.json({
      url: signedUrl,
      gcs_path: safeName,
      filename: file.name,
      content_type: file.type,
      size: file.size,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return Response.json({ error: 'Upload failed: ' + err.message }, { status: 500 });
  }
}
