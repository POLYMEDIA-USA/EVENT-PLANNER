export const dynamic = 'force-dynamic';

import { getUsers, getOrganizations } from '@/lib/gcs';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}

/**
 * Fuzzy org matching: normalize strings for comparison.
 * Handles case differences, extra whitespace, common abbreviations.
 */
function normalizeOrg(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\binc\.?\b/g, '')
    .replace(/\bcorp\.?\b/g, '')
    .replace(/\bllc\.?\b/g, '')
    .replace(/\bltd\.?\b/g, '')
    .replace(/\bco\.?\b/g, '')
    .replace(/[.,]/g, '')
    .trim();
}

function orgMatches(orgA, orgB) {
  const a = normalizeOrg(orgA);
  const b = normalizeOrg(orgB);
  if (!a || !b) return false;
  // Exact match after normalization
  if (a === b) return true;
  // One contains the other (handles "Acme" vs "Acme Corporation")
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

/**
 * GET /api/reps
 * Returns users filtered by the requesting user's organization.
 * - Admin: returns ALL users (all orgs)
 * - Supervisor: returns users whose org fuzzy-matches their own
 * - Sales rep: returns users in their exact org only
 *
 * Password hashes and session tokens are stripped.
 */
export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const users = await getUsers();

    let filtered;
    if (user.role === 'admin') {
      filtered = users;
    } else {
      // Supervisor and sales_rep: filter by org match
      filtered = users.filter(u =>
        u.organization_id === user.organization_id ||
        orgMatches(u.organization_name, user.organization_name)
      );
    }

    // Strip sensitive fields
    const safe = filtered.map(({ password_hash, session_token, ...u }) => u);
    return Response.json({ users: safe });
  } catch (err) {
    console.error('Error fetching reps:', err);
    return Response.json({ error: 'Failed to fetch reps' }, { status: 500 });
  }
}
