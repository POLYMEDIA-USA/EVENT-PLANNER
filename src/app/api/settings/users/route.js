export const dynamic = 'force-dynamic';

import { getUsers, saveUsers, getOrganizations, saveOrganizations } from '@/lib/gcs';
import { hashPassword, userMatchesToken, isVerifyAiUser } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => userMatchesToken(u, token)) || null;
}

// A Portal identity resolves to at most one local account, so a verifyai_email
// must not collide with another account's login email or verifyai_email —
// otherwise which account an SSO sign-in lands on depends on array order.
function verifyAiEmailTaken(users, value, selfId) {
  const v = (value || '').toLowerCase();
  if (!v) return false;
  return users.some(u => u.id !== selfId && (
    u.email.toLowerCase() === v || (u.verifyai_email || '').toLowerCase() === v
  ));
}

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const users = await getUsers();
    const safe = users.map(({ password_hash, session_token, ...u }) => u);
    return Response.json({ users: safe });
  } catch (err) {
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// Create user
export async function POST(request) {
  try {
    const admin = await authenticate(request);
    if (!admin || admin.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { full_name, email, phone, password, organization_name, role, auth_source, verifyai_email } = await request.json();
    // auth_source 'verifyai' declares "this person signs in with their VerifyAi
    // dashboard credentials" — no password is set here and none is ever stored;
    // the real check happens at that person's next login against VerifyAi's
    // auth-api. Anything else (including omitted) means a local password.
    const useVerifyAi = auth_source === 'verifyai';

    if (!full_name || !email || !organization_name) {
      return Response.json({ error: 'Name, email, and organization are required' }, { status: 400 });
    }
    if (!useVerifyAi && !password) {
      return Response.json({ error: 'Password is required for a local account' }, { status: 400 });
    }

    const users = await getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return Response.json({ error: 'Email already exists' }, { status: 409 });
    }
    const newVerifyAiEmail = useVerifyAi ? (verifyai_email || email) : verifyai_email;
    if (verifyAiEmailTaken(users, newVerifyAiEmail, null)) {
      return Response.json({ error: 'That VerifyAi email is already linked to another user' }, { status: 409 });
    }

    // Find or create organization
    let organizations = await getOrganizations();
    let org = organizations.find(o => o.name.toLowerCase() === organization_name.toLowerCase());
    if (!org) {
      org = { id: uuidv4(), name: organization_name, created_at: new Date().toISOString() };
      organizations.push(org);
      await saveOrganizations(organizations);
    }

    const user = {
      id: uuidv4(),
      email: email.toLowerCase(),
      full_name,
      phone: phone || '',
      organization_id: org.id,
      organization_name: org.name,
      role: role || 'sales_rep',
      session_token: '',
      created_at: new Date().toISOString(),
      ...(useVerifyAi
        ? { auth_source: 'verifyai', verifyai_email: (verifyai_email || email).toLowerCase() }
        // A local-password account may still carry a verifyai_email: that field
        // is an identity link for single sign-on, independent of which store
        // checks the password.
        : {
            auth_source: 'local',
            password_hash: hashPassword(password),
            ...(verifyai_email ? { verifyai_email: verifyai_email.toLowerCase() } : {}),
          }),
    };

    users.push(user);
    await saveUsers(users);

    // Audit log
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ user_id: admin.id, user_name: admin.full_name, action: 'user_created', entity_type: 'user', entity_id: user.id, details: `Created user "${user.full_name}" (${user.email}) with role ${user.role}, auth ${user.auth_source}` });

    const { password_hash, session_token, ...safeUser } = user;
    return Response.json({ user: safeUser });
  } catch (err) {
    console.error('Create user error:', err);
    return Response.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

// Update user
export async function PUT(request) {
  try {
    const admin = await authenticate(request);
    if (!admin || admin.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { user_id, full_name, email, phone, organization_name, role, password, auth_source, verifyai_email } = await request.json();

    const users = await getUsers();
    const idx = users.findIndex(u => u.id === user_id);
    if (idx === -1) return Response.json({ error: 'User not found' }, { status: 404 });

    // Check email uniqueness if changed
    if (email && email.toLowerCase() !== users[idx].email) {
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== user_id)) {
        return Response.json({ error: 'Email already in use' }, { status: 409 });
      }
      users[idx].email = email.toLowerCase();
    }

    if (full_name) users[idx].full_name = full_name;
    if (phone !== undefined) users[idx].phone = phone;
    if (role && ['admin', 'supervisor', 'sales_rep'].includes(role)) users[idx].role = role;

    // Switching auth source both ways. Going local requires a password in the
    // same request (an account with neither a password_hash nor a VerifyAi link
    // could never sign in again); going VerifyAi drops the stored hash so
    // there's no stale credential left behind.
    if (auth_source === 'verifyai') {
      // Break-glass: a VerifyAi outage must never lock every admin out of
      // FunnelFlow at once, so at least one admin always keeps a local password.
      const otherLocalAdmins = users.filter(
        (u, i) => i !== idx && u.role === 'admin' && !isVerifyAiUser(u) && u.password_hash
      );
      if (users[idx].role === 'admin' && otherLocalAdmins.length === 0) {
        return Response.json(
          { error: 'At least one admin must keep a local password (break-glass access). Give another admin a local password first.' },
          { status: 400 }
        );
      }
      const nextVerifyAiEmail = (verifyai_email || email || users[idx].email).toLowerCase();
      if (verifyAiEmailTaken(users, nextVerifyAiEmail, user_id)) {
        return Response.json({ error: 'That VerifyAi email is already linked to another user' }, { status: 409 });
      }
      users[idx].auth_source = 'verifyai';
      users[idx].verifyai_email = nextVerifyAiEmail;
      delete users[idx].password_hash;
    } else if (auth_source === 'local') {
      if (!password && !users[idx].password_hash) {
        return Response.json({ error: 'A password is required when switching this user to local sign-in' }, { status: 400 });
      }
      users[idx].auth_source = 'local';
      // verifyai_email is deliberately kept: it is an identity link for SSO, not
      // a credential. Clear it by sending an explicit empty verifyai_email.
    } else if (password && isVerifyAiUser(users[idx])) {
      // No local password exists to change on a VerifyAi account — silently
      // hashing one here would look like it worked and change nothing.
      return Response.json(
        { error: 'This user signs in with VerifyAi credentials. Their password is managed in the VerifyAi dashboard.' },
        { status: 400 }
      );
    }

    // Set or clear the SSO identity link on its own, for accounts that keep a
    // local password. (The 'verifyai' branch above already set it.)
    if (verifyai_email !== undefined && auth_source !== 'verifyai') {
      const v = String(verifyai_email || '').trim().toLowerCase();
      if (v && verifyAiEmailTaken(users, v, user_id)) {
        return Response.json({ error: 'That VerifyAi email is already linked to another user' }, { status: 409 });
      }
      if (v) users[idx].verifyai_email = v;
      else delete users[idx].verifyai_email;
    }

    if (password && users[idx].auth_source !== 'verifyai') {
      users[idx].password_hash = hashPassword(password);
    }

    if (organization_name) {
      let organizations = await getOrganizations();
      let org = organizations.find(o => o.name.toLowerCase() === organization_name.toLowerCase());
      if (!org) {
        org = { id: uuidv4(), name: organization_name, created_at: new Date().toISOString() };
        organizations.push(org);
        await saveOrganizations(organizations);
      }
      users[idx].organization_id = org.id;
      users[idx].organization_name = org.name;
    }

    users[idx].updated_at = new Date().toISOString();
    await saveUsers(users);

    // Audit log
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ user_id: admin.id, user_name: admin.full_name, action: 'user_updated', entity_type: 'user', entity_id: user_id, details: `Updated user "${users[idx].full_name}" (${users[idx].email})` });

    const { password_hash, session_token, ...safeUser } = users[idx];
    return Response.json({ user: safeUser });
  } catch (err) {
    console.error('Update user error:', err);
    return Response.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// Delete user
export async function DELETE(request) {
  try {
    const admin = await authenticate(request);
    if (!admin || admin.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { user_id } = await request.json();

    if (user_id === admin.id) {
      return Response.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    let users = await getUsers();
    const target = users.find(u => u.id === user_id);
    if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

    users = users.filter(u => u.id !== user_id);
    await saveUsers(users);

    // Audit log
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ user_id: admin.id, user_name: admin.full_name, action: 'user_deleted', entity_type: 'user', entity_id: user_id, details: `Deleted user "${target.full_name}" (${target.email})` });

    return Response.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    return Response.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
