'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function InteractionsPage() {
  const { user } = useAuth();
  const [interactions, setInteractions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isManager = user?.role === 'admin' || user?.role === 'supervisor';
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

  const addNote = async () => {
    if (!selectedCustomer || !newNote.trim()) return;
    setSaving(true);

    const event = JSON.parse(localStorage.getItem('cm_event') || '{}');
    const res = await fetch('/api/interactions', {
      method: 'POST', headers,
      body: JSON.stringify({
        customer_id: selectedCustomer.id,
        event_id: event.id || '',
        notes: newNote.trim(),
        interaction_type: 'manual_note',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setNewNote('');
      // Targeted update: append the new interaction instead of refetching everything
      if (data.interaction) {
        setInteractions(prev => [data.interaction, ...prev]);
      } else {
        fetchData();
      }
    }
    setSaving(false);
  };

  const typeLabels = {
    qr_scan: 'QR Check-in',
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

  // Get interactions for selected customer
  const customerInteractions = selectedCustomer
    ? interactions.filter(i => i.customer_id === selectedCustomer.id)
    : [];

  // Build interaction count index once, then derive lists
  const interactionIndex = useMemo(() => {
    const idx = {};
    for (const i of interactions) {
      idx[i.customer_id] = (idx[i.customer_id] || 0) + 1;
    }
    return idx;
  }, [interactions]);

  const customersWithCounts = useMemo(() => customers.map(c => ({
    ...c,
    interactionCount: interactionIndex[c.id] || 0,
  })), [customers, interactionIndex]);

  const sortedCustomers = useMemo(() => {
    const filtered = customersWithCounts.filter(c =>
      !search || [c.full_name, c.company_name, c.email, c.title].some(f => f?.toLowerCase().includes(search.toLowerCase()))
    );
    return filtered.sort((a, b) => {
      if (a.interactionCount && !b.interactionCount) return -1;
      if (!a.interactionCount && b.interactionCount) return 1;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  }, [customersWithCounts, search]);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {isManager ? 'Interactions' : 'My Interactions'}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer List Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-3 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                {loading ? (
                  <p className="p-4 text-center text-gray-400 text-sm">Loading...</p>
                ) : sortedCustomers.length === 0 ? (
                  <p className="p-4 text-center text-gray-400 text-sm">No customers found</p>
                ) : sortedCustomers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selectedCustomer?.id === c.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{c.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.title && <p className="text-xs text-gray-500 truncate">{c.title}</p>}
                      {c.title && c.company_name && <span className="text-xs text-gray-300">·</span>}
                      {c.company_name && <p className="text-xs text-gray-500 truncate">{c.company_name}</p>}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      {c.interactionCount > 0 ? (
                        <span className="text-xs text-indigo-600 font-medium">{c.interactionCount} note{c.interactionCount !== 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-xs text-gray-300">No interactions</span>
                      )}
                      {c.status && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          c.status === 'attended' ? 'bg-green-100 text-green-700' :
                          c.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                          c.status === 'declined' ? 'bg-red-100 text-red-700' :
                          c.status === 'approved' ? 'bg-teal-100 text-teal-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {c.status === 'approved' ? 'Approved to Invite' : c.status}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interaction Detail Panel */}
          <div className="lg:col-span-2">
            {!selectedCustomer ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-4xl mb-3 text-gray-300">◎</div>
                <p className="text-gray-400">Select a customer to view interactions and add notes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Customer Header */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedCustomer.full_name}</h2>
                      {selectedCustomer.title && <p className="text-sm text-indigo-600">{selectedCustomer.title}</p>}
                      {selectedCustomer.company_name && <p className="text-sm text-gray-600">{selectedCustomer.company_name}</p>}
                      <div className="flex gap-4 mt-2 text-xs text-gray-400">
                        {selectedCustomer.email && <span>{selectedCustomer.email}</span>}
                        {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                      </div>
                    </div>
                    {selectedCustomer.status && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        selectedCustomer.status === 'attended' ? 'bg-green-100 text-green-700' :
                        selectedCustomer.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                        selectedCustomer.status === 'declined' ? 'bg-red-100 text-red-700' :
                        selectedCustomer.status === 'invited' ? 'bg-amber-100 text-amber-700' :
                        selectedCustomer.status === 'approved' ? 'bg-teal-100 text-teal-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {selectedCustomer.status === 'approved' ? 'Approved to Invite' : selectedCustomer.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Add Note */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Add a Note</label>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    placeholder="Type your interaction notes here..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">Logged as: {user?.full_name}</p>
                    <button
                      onClick={addNote}
                      disabled={!newNote.trim() || saving}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Note'}
                    </button>
                  </div>
                </div>

                {/* Interaction History */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Interaction History ({customerInteractions.length})
                    </h3>
                  </div>

                  {customerInteractions.length === 0 ? (
                    <p className="p-6 text-center text-gray-400 text-sm">No interactions recorded yet</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {customerInteractions.map(i => (
                        <div key={i.id} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${typeColors[i.interaction_type] || 'bg-gray-100 text-gray-600'}`}>
                                {typeLabels[i.interaction_type] || i.interaction_type}
                              </span>
                              {i.sales_rep_name && (
                                <span className="text-xs text-gray-400">by {i.sales_rep_name}</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">{new Date(i.created_at).toLocaleString()}</span>
                          </div>
                          {i.notes && (
                            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{i.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
