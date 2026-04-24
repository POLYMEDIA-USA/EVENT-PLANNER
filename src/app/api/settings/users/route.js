export const dynamic = 'force-dynamic';

import { getUsers, saveUsers, getOrganizations, saveOrganizations } from '@/lib/gcs';
import { hashPassword, userMatchesToken } from '@/lib/auth';
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

    const { full_name, email, phone, password, organization_name, role } = await request.json();
    if (!full_name || !email || !password || !organization_name) {
      return Response.json({ error: 'Name, email, password, and organization are required' }, { status: 400 });
    }

    const users = await getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return Response.json({ error: 'Email already exists' }, { status: 409 });
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
      password_hash: hashPassword(password),
      organization_id: org.id,
      organization_name: org.name,
      role: role || 'sales_rep',
      session_token: '',
      created_at: new Date().toISOString(),
    };

    users.push(user);
    await saveUsers(users);

    // Audit log
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ user_id: admin.id, user_name: admin.full_name, action: 'user_created', entity_type: 'user', entity_id: user.id, details: `Created user "${user.full_name}" (${user.email}) with role ${user.role}` });

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

    const { user_id, full_name, email, phone, organization_name, role, password } = await request.json();

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

    if (password) {
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
