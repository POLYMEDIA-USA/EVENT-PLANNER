export const dynamic = 'force-dynamic';

import { getUsers, saveUsers, getOrganizations, saveOrganizations } from '@/lib/gcs';
import { hashPassword, generateToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const { full_name, email, phone, password, organization_name } = await request.json();

    if (!full_name || !email || !password || !organization_name) {
      return Response.json({ error: 'Name, email, password, and organization are required' }, { status: 400 });
    }

    const users = await getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return Response.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Find or create organization
    let organizations = await getOrganizations();
    let org = organizations.find(o => o.name.toLowerCase() === organization_name.toLowerCase());
    if (!org) {
      org = {
        id: uuidv4(),
        name: organization_name,
        created_at: new Date().toISOString(),
      };
      organizations.push(org);
      await saveOrganizations(organizations);
    }

    const token = generateToken();
    const user = {
      id: uuidv4(),
      email: email.toLowerCase(),
      full_name,
      phone: phone || '',
      password_hash: hashPassword(password),
      organization_id: org.id,
      organization_name: org.name,
      role: 'sales_rep',
      session_token: token,
      created_at: new Date().toISOString(),
    };

    users.push(user);
    await saveUsers(users);

    const { password_hash, ...safeUser } = user;
    return Response.json({ user: safeUser, token });
  } catch (err) {
    console.error('Register error:', err);
    return Response.json({ error: 'Registration failed' }, { status: 500 });
  }
}
