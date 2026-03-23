'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

const MERGE_FIELDS = ['lead_name', 'event_name', 'event_date', 'event_location', 'company_name', 'rsvp_link'];

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    company_name: '', company_logo_url: '', app_url: '',
    smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '',
    vonage_api_key: '', vonage_api_secret: '', vonage_from_number: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Email templates state
  const [templates, setTemplates] = useState([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body_html: '' });
  const [templateMessage, setTemplateMessage] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchData(); fetchTemplates(); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/settings', { headers });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) { console.error(err); }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/email/templates', { headers });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
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

  const handleTemplateSave = async () => {
    if (!templateForm.name || !templateForm.subject) {
      setTemplateMessage('Name and subject are required');
      return;
    }
    setTemplateMessage('');
    const payload = { ...templateForm, merge_fields: MERGE_FIELDS };

    if (editingTemplate) {
      const res = await fetch('/api/email/templates', {
        method: 'PUT', headers, body: JSON.stringify({ id: editingTemplate.id, ...payload }),
      });
      if (res.ok) { resetTemplateForm(); fetchTemplates(); setTemplateMessage('Template updated!'); }
      else setTemplateMessage('Failed to update template');
    } else {
      const res = await fetch('/api/email/templates', { method: 'POST', headers, body: JSON.stringify(payload) });
      if (res.ok) { resetTemplateForm(); fetchTemplates(); setTemplateMessage('Template created!'); }
      else setTemplateMessage('Failed to create template');
    }
  };

  const handleTemplateEdit = (t) => {
    setEditingTemplate(t);
    setTemplateForm({ name: t.name, subject: t.subject, body_html: t.body_html || '' });
    setShowTemplateForm(true);
  };

  const handleTemplateDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    await fetch('/api/email/templates', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
    fetchTemplates();
  };

  const resetTemplateForm = () => {
    setTemplateForm({ name: '', subject: '', body_html: '' });
    setEditingTemplate(null);
    setShowTemplateForm(false);
  };

  const set = (field) => (e) => setSettings({ ...settings, [field]: e.target.value });
  const setTpl = (field) => (e) => setTemplateForm({ ...templateForm, [field]: e.target.value });

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

        {/* SMS Settings (Vonage) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">SMS (Vonage)</h2>
          <p className="text-sm text-gray-500 mb-4">
            Configure Vonage (Nexmo) credentials to send SMS notifications to leads.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vonage API Key</label>
              <input type="text" value={settings.vonage_api_key} onChange={set('vonage_api_key')}
                placeholder="abc12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vonage API Secret</label>
              <input type="password" value={settings.vonage_api_secret} onChange={set('vonage_api_secret')}
                placeholder="Secret key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">From Number</label>
              <input type="text" value={settings.vonage_from_number} onChange={set('vonage_from_number')}
                placeholder="14155551234"
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

        {/* Email Templates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Email Templates</h2>
            <button
              onClick={() => { resetTemplateForm(); setShowTemplateForm(!showTemplateForm); }}
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              {showTemplateForm ? 'Cancel' : 'New Template'}
            </button>
          </div>

          {showTemplateForm && (
            <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{editingTemplate ? 'Edit Template' : 'Create Template'}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
                  <input type="text" value={templateForm.name} onChange={setTpl('name')}
                    placeholder="e.g. Event Invitation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line *</label>
                  <input type="text" value={templateForm.subject} onChange={setTpl('subject')}
                    placeholder="e.g. You're invited to {{event_name}}"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Body (HTML)</label>
                  <textarea value={templateForm.body_html} onChange={setTpl('body_html')} rows={6}
                    placeholder={"<p>Hello {{lead_name}},</p>\n<p>You're invited to {{event_name}} on {{event_date}} at {{event_location}}.</p>\n<p><a href=\"{{rsvp_link}}\">RSVP Here</a></p>"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                  <p className="text-xs text-gray-400 mt-1">
                    Available merge fields: {MERGE_FIELDS.map(f => `{{${f}}}`).join(', ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleTemplateSave}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                    {editingTemplate ? 'Update' : 'Create'} Template
                  </button>
                  <button onClick={resetTemplateForm}
                    className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {templateMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${templateMessage.includes('!') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {templateMessage}
            </div>
          )}

          {templates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No email templates yet. Create one to get started.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {templates.map(t => (
                <div key={t.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-500 truncate">Subject: {t.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Created by {t.created_by} on {new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleTemplateEdit(t)} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                    <button onClick={() => handleTemplateDelete(t.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
