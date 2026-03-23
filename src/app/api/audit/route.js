export const dynamic = 'force-dynamic';

import { getUsers, getAuditLog } from '@/lib/gcs';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let log = await getAuditLog();

    // Newest first
    log.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Filter by entity
    if (entityType) log = log.filter(e => e.entity_type === entityType);
    if (entityId) log = log.filter(e => e.entity_id === entityId);

    // Pagination
    log = log.slice(0, limit);

    return Response.json({ entries: log });
  } catch (err) {
    console.error('Audit GET error:', err);
    return Response.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
