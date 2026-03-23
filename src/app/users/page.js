'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', organization_name: '', role: 'sales_rep' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: '', message: '' });
  const [emailLoading, setEmailLoading] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/settings/users', { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (editingUser) {
      const body = { user_id: editingUser.id, full_name: form.full_name, email: form.email, phone: form.phone, organization_name: form.organization_name, role: form.role };
      if (form.password) body.password = form.password;

      const res = await fetch('/api/settings/users', { method: 'PUT', headers, body: JSON.stringify(body) });
      if (res.ok) { resetForm(); fetchUsers(); }
      else { const data = await res.json(); setError(data.error || 'Failed to update user'); }
    } else {
      if (!form.password) { setError('Password is required for new users'); return; }
      const res = await fetch('/api/settings/users', { method: 'POST', headers, body: JSON.stringify(form) });
      if (res.ok) { resetForm(); fetchUsers(); }
      else { const data = await res.json(); setError(data.error || 'Failed to create user'); }
    }
  };

  const handleEdit = (u) => {
    setEditingUser(u);
    setForm({ full_name: u.full_name, email: u.email, phone: u.phone || '', password: '', organization_name: u.organization_name || '', role: u.role });
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (u) => {
    if (!confirm(`Delete user "${u.full_name}"? This cannot be undone.`)) return;
    const res = await fetch('/api/settings/users', { method: 'DELETE', headers, body: JSON.stringify({ user_id: u.id }) });
    if (res.ok) fetchUsers();
    else { const data = await res.json(); alert(data.error || 'Failed to delete user'); }
  };

  const resetForm = () => {
    setForm({ full_name: '', email: '', phone: '', password: '', organization_name: '', role: 'sales_rep' });
    setEditingUser(null);
    setShowForm(false);
    setError('');
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filtered.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filtered.map(u => u.id));
    }
  };

  const handleSendEmail = async () => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one user');
      return;
    }
    if (!emailForm.subject || !emailForm.message) {
      alert('Subject and message are required');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await fetch('/api/email/send-users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_ids: selectedUsers,
          subject: emailForm.subject,
          message: emailForm.message,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setShowEmailModal(false);
        setEmailForm({ subject: '', message: '' });
        setSelectedUsers([]);
      } else {
        alert(data.error || 'Failed to send emails');
      }
    } catch (error) {
      alert('Error sending emails');
    }
    setEmailLoading(false);
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const setEmail = (field) => (e) => setEmailForm({ ...emailForm, [field]: e.target.value });

  const filtered = users.filter(u =>
    !search || [u.full_name, u.email, u.organization_name, u.role].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  if (user?.role !== 'admin') {
    return <AppShell><div className="p-8 text-center text-gray-400">Admin access required</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <div className="flex gap-2">
            {selectedUsers.length > 0 && (
              <button
                onClick={() => setShowEmailModal(true)}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
              >
                Send Email ({selectedUsers.length})
              </button>
            )}
            <button
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              {showForm ? 'Cancel' : 'Add User'}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{editingUser ? 'Edit User' : 'Add New User'}</h2>

            {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" value={form.full_name} onChange={set('full_name')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email / Username *</label>
                <input type="text" value={form.email} onChange={set('email')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={form.phone} onChange={set('phone')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingUser ? 'New Password (leave blank to keep)' : 'Password *'}
                </label>
                <input type="password" value={form.password} onChange={set('password')}
                  required={!editingUser}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization *</label>
                <input type="text" value={form.organization_name} onChange={set('organization_name')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={set('role')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
                  <option value="sales_rep">Sales Rep</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                  {editingUser ? 'Update' : 'Create'} User
                </button>
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-2">
              <button onClick={handleSelectAll} className="text-sm text-indigo-600 hover:text-indigo-800">
                {selectedUsers.length === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-gray-400 ml-4">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === filtered.length && filtered.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Organization</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(u.id)}
                        onChange={() => handleSelectUser(u.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{u.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.phone || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.organization_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                        u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : u.role === 'supervisor' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role === 'admin' ? 'Admin' : u.role === 'supervisor' ? 'Supervisor' : 'Sales Rep'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => handleEdit(u)} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                      {u.id !== user?.id && (
                        <button onClick={() => handleDelete(u)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {loading ? (
              <p className="p-6 text-center text-gray-400">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-gray-400">No users found</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map(u => (
                  <div key={u.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(u.id)}
                          onChange={() => handleSelectUser(u.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <p className="text-sm font-semibold text-gray-900 truncate">{u.full_name}</p>
                      </div>
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ml-2 ${
                        u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : u.role === 'supervisor' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role === 'admin' ? 'Admin' : u.role === 'supervisor' ? 'Supervisor' : 'Sales Rep'}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="col-span-2"><dt className="text-gray-400 inline">Email:</dt> <dd className="text-gray-700 inline truncate">{u.email}</dd></div>
                      {u.phone && <div><dt className="text-gray-400 inline">Phone:</dt> <dd className="text-gray-700 inline">{u.phone}</dd></div>}
                      <div><dt className="text-gray-400 inline">Org:</dt> <dd className="text-gray-700 inline truncate">{u.organization_name}</dd></div>
                      <div className="col-span-2"><dt className="text-gray-400 inline">Created:</dt> <dd className="text-gray-700 inline">{new Date(u.created_at).toLocaleDateString()}</dd></div>
                    </dl>
                    <div className="flex gap-4 pt-1">
                      <button onClick={() => handleEdit(u)} className="text-xs text-indigo-600 font-medium">Edit</button>
                      {u.id !== user?.id && (
                        <button onClick={() => handleDelete(u)} className="text-xs text-red-500 font-medium">Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showEmailModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Send Email to Users</h2>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    Sending to {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}:
                  </p>
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {selectedUsers.map(id => {
                      const u = users.find(user => user.id === id);
                      return u ? (
                        <div key={id} className="text-xs text-gray-500">{u.full_name} ({u.email})</div>
                      ) : null;
                    })}
                  </div>
                </div>
                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                    <input
                      type="text"
                      value={emailForm.subject}
                      onChange={setEmail('subject')}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                    <textarea
                      value={emailForm.message}
                      onChange={setEmail('message')}
                      required
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="Enter your message here..."
                    />
                  </div>
                </form>
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={handleSendEmail}
                    disabled={emailLoading}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {emailLoading ? 'Sending...' : 'Send Email'}
                  </button>
                  <button
                    onClick={() => { setShowEmailModal(false); setEmailForm({ subject: '', message: '' }); }}
                    className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
