export const dynamic = 'force-dynamic';

import { getUsers, saveUsers } from '@/lib/gcs';
import { hashPassword } from '@/lib/auth';

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return Response.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 4) {
      return Response.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    const users = await getUsers();
    const user = users.find(u => u.reset_token === token);

    if (!user) {
      return Response.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    if (new Date(user.reset_token_expires) < new Date()) {
      // Clean up expired token
      delete user.reset_token;
      delete user.reset_token_expires;
      await saveUsers(users);
      return Response.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 });
    }

    // Update password and clear reset token
    user.password_hash = hashPassword(password);
    delete user.reset_token;
    delete user.reset_token_expires;
    // Invalidate ALL existing sessions so the user must log in fresh everywhere
    delete user.session_token;
    user.session_tokens = [];

    await saveUsers(users);

    return Response.json({ message: 'Password has been reset. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
