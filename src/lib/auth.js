import crypto from 'crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verify;
}

export function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateRSVPToken() {
  return crypto.randomBytes(16).toString('base64url');
}

// 4-char check-in code using charset that avoids ambiguous glyphs (no I, O, 0, 1).
// Callers can pass one or more lists whose qr_code_data values must not collide —
// typically customers and team-attendance records share a single namespace so the
// scanner can resolve any scanned code without branching on length/prefix.
export function generateUniqueQRCode(...lists) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existing = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (row?.qr_code_data) existing.add(row.qr_code_data);
    }
  }
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (existing.has(code));
  return code;
}

export async function verifyToken(token) {
  if (!token) return null;
  const { getUsers } = await import('./gcs');
  const users = await getUsers();
  return users.find(u => u.session_token === token) || null;
}
