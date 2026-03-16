'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    company_name: '', company_logo_url: '', app_url: '',
    smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/settings', { headers });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
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
          <p className="text-sm text-gray-500 mb-4">
            For Google Workspace / Gmail: use <strong>smtp.gmail.com</strong>, port <strong>587</strong>, and an <a href="https://myaccount.google.com/apppasswords" target="_blank" className="text-indigo-600 underline">App Password</a>.
          </p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP User (email address)</label>
              <input type="text" value={settings.smtp_user} onChange={set('smtp_user')}
                placeholder="sales@verifyai.net"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password (App Password)</label>
              <input type="password" value={settings.smtp_pass} onChange={set('smtp_pass')}
                placeholder="16-character app password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">From Address (optional, defaults to SMTP user)</label>
              <input type="text" value={settings.smtp_from || ''} onChange={set('smtp_from')}
                placeholder="sales@verifyai.net"
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

      </div>
    </AppShell>
  );
}
