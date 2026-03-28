'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

// "invited" is excluded — that status is only set when an invitation email is sent
const STATUSES = ['possible', 'approved', 'accepted', 'declined', 'attended'];

export default function RepsPage() {
  const { user } = useAuth();
  const [reps, setReps] = useState([]);
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedRep, setExpandedRep] = useState(null);
  const [updating, setUpdating] = useState(null); // lead id being updated

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const event = JSON.parse(localStorage.getItem('cm_event') || 'null');
      const leadsUrl = event ? `/api/leads?event_id=${event.id}` : '/api/leads';
      const [repsRes, leadsRes] = await Promise.all([
        fetch('/api/reps', { headers }),
        fetch(leadsUrl, { headers }),
      ]);
      if (repsRes.ok) setReps((await repsRes.json()).users || []);
      if (leadsRes.ok) setLeads((await leadsRes.json()).customers || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    setUpdating(leadId);
    try {
      const res = await fetch('/api/leads', {
        method: 'PUT', headers,
        body: JSON.stringify({ id: leadId, status: newStatus }),
      });
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update status');
      }
    } catch (err) { alert('Network error'); }
    setUpdating(null);
  };

  const getRepLeads = (repId) => leads.filter(l => l.assigned_rep_id === repId);

  const filtered = useMemo(() => reps.filter(u =>
    !search || [u.full_name, u.email, u.organization_name, u.role].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  ), [reps, search]);

  if (!user || (user.role !== 'supervisor' && user.role !== 'admin')) {
    return <AppShell><div className="p-8 text-center text-gray-400">Supervisor or Admin access required</div></AppShell>;
  }

  const roleBadge = (role) => {
    const styles = { admin: 'bg-indigo-100 text-indigo-700', supervisor: 'bg-amber-100 text-amber-700', sales_rep: 'bg-gray-100 text-gray-600' };
    const labels = { admin: 'Admin', supervisor: 'Supervisor', sales_rep: 'Sales Rep' };
    return (
      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${styles[role] || styles.sales_rep}`}>
        {labels[role] || 'Sales Rep'}
      </span>
    );
  };

  const statusStyles = {
    possible: 'bg-blue-100 text-blue-700',
    approved: 'bg-teal-100 text-teal-700',
    invited: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    attended: 'bg-purple-100 text-purple-700',
  };

  const toggleExpand = (repId) => {
    setExpandedRep(expandedRep === repId ? null : repId);
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Reps</h1>
            <p className="text-sm text-gray-500 mt-1">
              Sales reps in your organization ({user.organization_name}) — click to view and manage leads
            </p>
          </div>
          <span className="text-sm text-gray-400">{filtered.length} rep{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search reps..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Organization</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Leads</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Joined</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No reps found</td></tr>
                ) : filtered.map(u => {
                  const repLeads = getRepLeads(u.id);
                  const isExpanded = expandedRep === u.id;
                  return (
                    <tr key={u.id} className="border-b border-gray-100">
                      <td colSpan={7} className="p-0">
                        <div className={`flex items-center hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-indigo-50' : ''}`} onClick={() => toggleExpand(u.id)}>
                          <div className="px-4 py-3 text-sm font-medium text-gray-800 w-1/6">{u.full_name}</div>
                          <div className="px-4 py-3 text-sm text-gray-600 w-1/6">{u.email}</div>
                          <div className="px-4 py-3 text-sm text-gray-600 w-1/8">{u.phone || '-'}</div>
                          <div className="px-4 py-3 text-sm text-gray-600 w-1/6">{u.organization_name}</div>
                          <div className="px-4 py-3 w-1/8">{roleBadge(u.role)}</div>
                          <div className="px-4 py-3 w-1/8">
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-bold ${repLeads.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                              {repLeads.length}
                            </span>
                            <span className="ml-1 text-xs text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                          </div>
                          <div className="px-4 py-3 text-xs text-gray-400 w-1/8">{new Date(u.created_at).toLocaleDateString()}</div>
                        </div>
                        {isExpanded && (
                          <div className="bg-gray-50 px-8 py-3 border-t border-gray-200">
                            {repLeads.length === 0 ? (
                              <p className="text-sm text-gray-400 italic">No leads assigned to this rep</p>
                            ) : (
                              <table className="w-full">
                                <thead>
                                  <tr>
                                    <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Lead Name</th>
                                    <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Company</th>
                                    <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Email</th>
                                    <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Status</th>
                                    <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Score</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {repLeads.map(l => (
                                    <tr key={l.id} className="border-t border-gray-200 hover:bg-gray-100">
                                      <td className="px-2 py-1.5 text-sm text-gray-700">{l.full_name}</td>
                                      <td className="px-2 py-1.5 text-sm text-gray-500">{l.company_name || '-'}</td>
                                      <td className="px-2 py-1.5 text-sm text-gray-500">{l.email}</td>
                                      <td className="px-2 py-1.5">
                                        <select
                                          value={l.status}
                                          disabled={updating === l.id}
                                          onChange={(e) => { e.stopPropagation(); updateLeadStatus(l.id, e.target.value); }}
                                          onClick={(e) => e.stopPropagation()}
                                          className={`px-2 py-0.5 text-xs rounded-full font-medium border-0 cursor-pointer ${statusStyles[l.status] || 'bg-gray-100 text-gray-600'} ${updating === l.id ? 'opacity-50' : ''}`}
                                        >
                                          {STATUSES.map(s => <option key={s} value={s}>{s === 'approved' ? 'Approved to Invite' : s}</option>)}
                                        </select>
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-bold ${
                                          l.lead_score_label === 'hot' ? 'bg-red-100 text-red-700' :
                                          l.lead_score_label === 'warm' ? 'bg-amber-100 text-amber-700' :
                                          'bg-blue-100 text-blue-700'
                                        }`}>
                                          {l.lead_score || 0}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {loading ? (
              <p className="p-6 text-center text-gray-400">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-gray-400">No reps found</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map(u => {
                  const repLeads = getRepLeads(u.id);
                  const isExpanded = expandedRep === u.id;
                  return (
                    <div key={u.id}>
                      <div className="p-4 space-y-2 cursor-pointer" onClick={() => toggleExpand(u.id)}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900 truncate">{u.full_name}</p>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-bold ${repLeads.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                              {repLeads.length} leads
                            </span>
                            {roleBadge(u.role)}
                          </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div className="col-span-2"><dt className="text-gray-400 inline">Email:</dt> <dd className="text-gray-700 inline truncate">{u.email}</dd></div>
                          {u.phone && <div><dt className="text-gray-400 inline">Phone:</dt> <dd className="text-gray-700 inline">{u.phone}</dd></div>}
                          <div><dt className="text-gray-400 inline">Org:</dt> <dd className="text-gray-700 inline truncate">{u.organization_name}</dd></div>
                        </dl>
                        <p className="text-xs text-indigo-500">{isExpanded ? '▼ Hide leads' : '▶ Show leads'}</p>
                      </div>
                      {isExpanded && (
                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                          {repLeads.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">No leads assigned</p>
                          ) : (
                            <div className="space-y-2">
                              {repLeads.map(l => (
                                <div key={l.id} className="bg-white rounded-lg p-3 border border-gray-100 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">{l.full_name}</p>
                                      <p className="text-xs text-gray-500">{l.company_name || l.email}</p>
                                    </div>
                                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-bold ${
                                      l.lead_score_label === 'hot' ? 'bg-red-100 text-red-700' :
                                      l.lead_score_label === 'warm' ? 'bg-amber-100 text-amber-700' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>
                                      {l.lead_score || 0}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">Status:</span>
                                    <select
                                      value={l.status}
                                      disabled={updating === l.id}
                                      onChange={(e) => updateLeadStatus(l.id, e.target.value)}
                                      className={`px-2 py-0.5 text-xs rounded-full font-medium border-0 cursor-pointer ${statusStyles[l.status] || 'bg-gray-100 text-gray-600'} ${updating === l.id ? 'opacity-50' : ''}`}
                                    >
                                      {STATUSES.map(s => <option key={s} value={s}>{s === 'approved' ? 'Approved to Invite' : s}</option>)}
                                    </select>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
