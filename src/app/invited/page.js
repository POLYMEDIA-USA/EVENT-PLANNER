'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function InvitedPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [invited, setInvited] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [tab, setTab] = useState('promote'); // 'promote' or 'invited'
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [leadsRes, invitedRes] = await Promise.all([
        fetch('/api/leads', { headers }),
        fetch('/api/invited', { headers }),
      ]);
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads((data.customers || []).filter(c => c.status === 'possible'));
      }
      if (invitedRes.ok) {
        const data = await invitedRes.json();
        setInvited(data.customers || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map(l => l.id)));
    }
  };

  const promoteSelected = async () => {
    if (selected.size === 0) return;
    const res = await fetch('/api/invited', {
      method: 'POST', headers,
      body: JSON.stringify({ customer_ids: [...selected] }),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Promoted ${data.promoted} leads to Invited status`);
      setSelected(new Set());
      fetchData();
    }
  };

  const sendInviteEmails = async () => {
    const toSend = invited.filter(c => c.status === 'invited');
    if (toSend.length === 0) { alert('No unsent invitations'); return; }

    const res = await fetch('/api/email/send-invites', {
      method: 'POST', headers,
      body: JSON.stringify({ customer_ids: toSend.map(c => c.id) }),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Sent ${data.sent} invitation emails`);
      fetchData();
    } else {
      alert('Failed to send emails. Check Settings for email configuration.');
    }
  };

  if (user?.role !== 'admin') {
    return <AppShell><div className="p-8 text-center text-gray-400">Admin access required</div></AppShell>;
  }

  const statusColors = {
    invited: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    attended: 'bg-purple-100 text-purple-700',
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Invited Customers</h1>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('promote')}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'promote' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Promote Leads ({leads.length})
          </button>
          <button onClick={() => setTab('invited')}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'invited' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Invited List ({invited.length})
          </button>
        </div>

        {tab === 'promote' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">{selected.size} selected</p>
              <button onClick={promoteSelected} disabled={selected.size === 0}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                Promote to Invited
              </button>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" checked={selected.size === leads.length && leads.length > 0}
                      onChange={selectAll} className="rounded border-gray-300" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Organization</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Added By</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No leads to promote</td></tr>
                ) : leads.map(l => (
                  <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleSelect(l.id)}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)}
                        className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{l.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{l.company_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{l.email}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{l.organization_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'invited' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">{invited.length} invited customers</p>
              <button onClick={sendInviteEmails}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                Send Invitation Emails
              </button>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Organization</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Invited At</th>
                </tr>
              </thead>
              <tbody>
                {invited.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No invited customers yet</td></tr>
                ) : invited.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.company_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{c.invited_at ? new Date(c.invited_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
