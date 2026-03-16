'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    company_name: '', company_logo_url: '', app_url: '',
    smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '',
  });
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, usersRes] = await Promise.all([
        fetch('/api/settings', { headers }),
        fetch('/api/settings/users', { headers }),
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
    } catch (err) { console.error(err); }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/settings', { method: 'POST', headers, body: JSON.stringify(settings) });
    if (res.ok) setMessage('Settings saved!');
    else setMessage('Failed to save settings');
    setSaving(false);
  };

  const toggleRole = async (userId, newRole) => {
    const res = await fetch('/api/settings/users', {
      method: 'PUT', headers,
      body: JSON.stringify({ user_id: userId, role: newRole }),
    });
    if (res.ok) fetchData();
  };

  const set = (field) => (e) => setSettings({ ...settings, [field]: e.target.value });

  if (user?.role !== 'admin') {
    return <AppShell><div className="p-8 text-center text-gray-400">Admin access required</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* General Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">General</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input type="text" value={settings.company_name} onChange={set('company_name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
              <input type="url" value={settings.company_logo_url} onChange={set('company_logo_url')}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">App URL (for email links)</label>
              <input type="url" value={settings.app_url} onChange={set('app_url')}
                placeholder="https://your-app.run.app"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Email (SMTP)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
              <input type="text" value={settings.smtp_host} onChange={set('smtp_host')}
                placeholder="smtp.gmail.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
              <input type="text" value={settings.smtp_port} onChange={set('smtp_port')}
                placeholder="587"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP User</label>
              <input type="text" value={settings.smtp_user} onChange={set('smtp_user')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
              <input type="password" value={settings.smtp_pass} onChange={set('smtp_pass')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('saved') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        <button onClick={saveSettings} disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 mb-8">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        {/* User Management */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Users</h2>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Organization</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{u.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.organization_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                      u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleRole(u.id, u.role === 'admin' ? 'sales_rep' : 'admin')}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Make {u.role === 'admin' ? 'Sales Rep' : 'Admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
