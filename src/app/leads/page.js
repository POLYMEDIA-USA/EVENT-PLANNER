'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function LeadsPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState({ full_name: '', title: '', company_name: '', email: '', phone: '', alt_email: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeads = async () => {
    try {
      const event = JSON.parse(localStorage.getItem('cm_event') || 'null');
      const url = event ? `/api/leads?event_id=${event.id}` : '/api/leads';
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const event = JSON.parse(localStorage.getItem('cm_event') || 'null');

    if (editingLead) {
      const res = await fetch('/api/leads', {
        method: 'PUT', headers, body: JSON.stringify({ id: editingLead.id, ...form }),
      });
      if (res.ok) { resetForm(); fetchLeads(); }
    } else {
      const body = { ...form };
      if (event) body.event_id = event.id;
      const res = await fetch('/api/leads', { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.ok) { resetForm(); fetchLeads(); }
    }
  };

  const handleEdit = (lead) => {
    setEditingLead(lead);
    setForm({
      full_name: lead.full_name, title: lead.title, company_name: lead.company_name,
      email: lead.email, phone: lead.phone, alt_email: lead.alt_email,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this lead?')) return;
    await fetch('/api/leads', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
    fetchLeads();
  };

  const resetForm = () => {
    setForm({ full_name: '', title: '', company_name: '', email: '', phone: '', alt_email: '' });
    setEditingLead(null);
    setShowForm(false);
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const filtered = customers.filter(c =>
    !search || [c.full_name, c.company_name, c.email].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const event = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cm_event') || 'null') : null;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            {event && <p className="text-sm text-gray-500">Event: {event.name}</p>}
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : 'Add Lead'}
          </button>
        </div>

        {!event && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg">
            No event selected. Leads will show across all events. Select an event from the Dashboard to filter.
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{editingLead ? 'Edit Lead' : 'Add New Lead'}</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" value={form.full_name} onChange={set('full_name')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={set('title')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                <input type="text" value={form.company_name} onChange={set('company_name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={set('email')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={form.phone} onChange={set('phone')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alt Email</label>
                <input type="email" value={form.alt_email} onChange={set('alt_email')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                  {editingLead ? 'Update' : 'Add'} Lead
                </button>
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Organization</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Added By</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No leads yet. Click &quot;Add Lead&quot; to get started.</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.company_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                        { possible: 'bg-blue-100 text-blue-700', invited: 'bg-amber-100 text-amber-700',
                          accepted: 'bg-green-100 text-green-700', declined: 'bg-red-100 text-red-700',
                          attended: 'bg-purple-100 text-purple-700' }[c.status] || 'bg-gray-100 text-gray-600'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{c.added_by_name}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => handleEdit(c)} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
