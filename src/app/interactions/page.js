'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function InteractionsPage() {
  const { user } = useAuth();
  const [interactions, setInteractions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [intRes, custRes] = await Promise.all([
        fetch('/api/interactions', { headers }),
        fetch('/api/leads', { headers }),
      ]);
      if (intRes.ok) {
        const data = await intRes.json();
        setInteractions(data.interactions || []);
      }
      if (custRes.ok) {
        const data = await custRes.json();
        setCustomers(data.customers || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const addInteraction = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !notes.trim()) return;

    const event = JSON.parse(localStorage.getItem('cm_event') || '{}');
    const res = await fetch('/api/interactions', {
      method: 'POST', headers,
      body: JSON.stringify({
        customer_id: selectedCustomer,
        event_id: event.id || '',
        notes,
        interaction_type: 'manual_note',
      }),
    });

    if (res.ok) {
      setSelectedCustomer('');
      setNotes('');
      setShowForm(false);
      fetchData();
    }
  };

  const typeLabels = {
    qr_scan: 'QR Scan',
    manual_note: 'Note',
    rsvp_accept: 'RSVP Accept',
    rsvp_decline: 'RSVP Decline',
    email_sent: 'Email Sent',
  };

  const typeColors = {
    qr_scan: 'bg-purple-100 text-purple-700',
    manual_note: 'bg-blue-100 text-blue-700',
    rsvp_accept: 'bg-green-100 text-green-700',
    rsvp_decline: 'bg-red-100 text-red-700',
    email_sent: 'bg-amber-100 text-amber-700',
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {user?.role === 'admin' ? 'All Interactions' : 'My Interactions'}
          </h1>
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            {showForm ? 'Cancel' : 'Log Interaction'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <form onSubmit={addInteraction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.company_name})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} required
                  placeholder="Describe the interaction..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                Save Interaction
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Notes</th>
                {user?.role === 'admin' && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rep</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : interactions.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No interactions logged yet</td></tr>
              ) : interactions.map(i => (
                <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{i.customer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${typeColors[i.interaction_type] || 'bg-gray-100 text-gray-600'}`}>
                      {typeLabels[i.interaction_type] || i.interaction_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{i.notes}</td>
                  {user?.role === 'admin' && <td className="px-4 py-3 text-sm text-gray-500">{i.sales_rep_name}</td>}
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(i.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
