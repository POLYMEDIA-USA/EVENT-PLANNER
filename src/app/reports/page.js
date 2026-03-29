'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';
import Pagination, { paginate } from '@/components/Pagination';

export default function ReportsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview'); // 'overview', 'emails', 'post-event'
  const [customers, setCustomers] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailHtml, setEmailHtml] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const previewRef = useRef(null);

  // Post-event state
  const [postEventData, setPostEventData] = useState(null);
  const [postEventLoading, setPostEventLoading] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [selectedReps, setSelectedReps] = useState(new Set());
  const [postEventSending, setPostEventSending] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [expandedOrg, setExpandedOrg] = useState(null);
  const [expandedSup, setExpandedSup] = useState(null);
  const [expandedRep, setExpandedRep] = useState(null);
  const [rptPage, setRptPage] = useState(1);
  const [rptPageSize, setRptPageSize] = useState(50);
  const [emlPage, setEmlPage] = useState(1);
  const [emlPageSize, setEmlPageSize] = useState(50);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [custRes, intRes, emailRes, usersRes] = await Promise.all([
        fetch('/api/leads', { headers }),
        fetch('/api/interactions', { headers }),
        fetch('/api/email/log', { headers }),
        fetch('/api/reps', { headers }),
      ]);
      if (custRes.ok) setCustomers((await custRes.json()).customers || []);
      if (intRes.ok) setInteractions((await intRes.json()).interactions || []);
      if (emailRes.ok) setEmails((await emailRes.json()).emails || []);
      if (usersRes.ok) setAllUsers((await usersRes.json()).users || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchPostEvent = async () => {
    setPostEventLoading(true);
    try {
      const res = await fetch('/api/reports/post-event', { headers });
      if (res.ok) setPostEventData(await res.json());
    } catch (err) { console.error(err); }
    setPostEventLoading(false);
  };

  const downloadCSV = async () => {
    const res = await fetch('/api/reports/post-event', {
      method: 'POST', headers,
      body: JSON.stringify({ action: 'csv' }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `post-event-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const sendReports = async () => {
    if (selectedReps.size === 0) { alert('Select at least one rep'); return; }
    setPostEventSending(true);
    try {
      const res = await fetch('/api/reports/post-event', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'email', rep_ids: [...selectedReps] }),
      });
      const data = await res.json();
      alert(data.message || data.error);
    } catch (err) { alert('Failed: ' + err.message); }
    setPostEventSending(false);
  };

  const toggleRep = (id) => {
    const next = new Set(selectedReps);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedReps(next);
  };

  const viewEmail = async (emailId) => {
    const res = await fetch(`/api/email/log?email_id=${emailId}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setSelectedEmail(data.email);
      setEmailHtml(data.email.html_body);
    }
  };

  const printEmail = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>${selectedEmail.subject}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #4F46E5; padding-bottom: 16px; margin-bottom: 24px; }
        .meta { color: #6B7280; font-size: 13px; margin: 4px 0; }
        .content { margin-top: 24px; }
        @media print { body { margin: 20px; } }
      </style></head><body>
        <div class="header">
          <h2 style="color:#4F46E5;margin:0;">${selectedEmail.subject}</h2>
          <p class="meta"><strong>From:</strong> ${selectedEmail.from}</p>
          <p class="meta"><strong>To:</strong> ${selectedEmail.to}</p>
          <p class="meta"><strong>Date:</strong> ${new Date(selectedEmail.created_at).toLocaleString()}</p>
          <p class="meta"><strong>Type:</strong> ${selectedEmail.type} (${selectedEmail.direction})</p>
        </div>
        <div class="content">${selectedEmail.html_body}</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const sorted = useMemo(() => {
    const filtered = customers.filter(c => filter === 'all' || c.status === filter);
    return [...filtered].sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [customers, filter, sortBy, sortDir]);
  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  // Build hierarchical tree: Company → Supervisors → Reps → Leads
  const buildOrgTree = () => {
    // Normalize org names for grouping
    const norm = (n) => (n || '').trim().toLowerCase();

    // Group users by normalized org name
    const orgMap = {};
    allUsers.forEach(u => {
      const key = norm(u.organization_name);
      const displayName = u.organization_name || 'Unknown';
      if (!orgMap[key]) orgMap[key] = { name: displayName, supervisors: [], reps: [], users: [] };
      orgMap[key].users.push(u);
      if (u.role === 'supervisor') orgMap[key].supervisors.push(u);
      if (u.role === 'sales_rep') orgMap[key].reps.push(u);
    });

    // Attach leads to reps and compute stats
    Object.values(orgMap).forEach(org => {
      org.stats = { total: 0, approved: 0, invited: 0, declined: 0, attended: 0, interactions: 0 };
      org.unassignedLeads = [];
      org.reps.forEach(rep => {
        rep.leads = customers.filter(c => c.assigned_rep_id === rep.id);
        rep.interactionCount = interactions.filter(i => rep.leads.some(l => l.id === i.customer_id)).length;
        rep.leads.forEach(l => {
          org.stats.total++;
          if (l.status === 'approved') org.stats.approved++;
          if (['invited', 'accepted'].includes(l.status)) org.stats.invited++;
          if (l.status === 'declined') org.stats.declined++;
          if (l.status === 'attended') org.stats.attended++;
        });
        org.stats.interactions += rep.interactionCount;
      });
      // Leads assigned to supervisors or unassigned but in this org
      const repIds = new Set(org.reps.map(r => r.id));
      const orgLeads = customers.filter(c => norm(c.organization_name) === norm(org.name) || norm(c.assigned_rep_org) === norm(org.name));
      org.unassignedLeads = orgLeads.filter(l => !l.assigned_rep_id || (!repIds.has(l.assigned_rep_id) && org.supervisors.some(s => s.id === l.added_by_user_id)));
      org.unassignedLeads.forEach(l => {
        org.stats.total++;
        if (l.status === 'approved') org.stats.approved++;
        if (['invited', 'accepted'].includes(l.status)) org.stats.invited++;
        if (l.status === 'attended') org.stats.attended++;
      });
    });

    return Object.values(orgMap).sort((a, b) => a.name.localeCompare(b.name));
  };
  const orgTree = useMemo(() => buildOrgTree(), [allUsers, customers, interactions]);

  const filteredEmails = useMemo(() => emails.filter(e =>
    !emailFilter || [e.to, e.customer_name, e.subject, e.type].some(f => f?.toLowerCase().includes(emailFilter.toLowerCase()))
  ), [emails, emailFilter]);

  const statusColors = {
    possible: 'bg-blue-100 text-blue-700', approved: 'bg-teal-100 text-teal-700',
    invited: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700', declined: 'bg-red-100 text-red-700',
    attended: 'bg-purple-100 text-purple-700',
  };

  if (user?.role !== 'admin' && user?.role !== 'supervisor') {
    return <AppShell><div className="p-8 text-center text-gray-400">Admin access required</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setTab('overview'); setSelectedEmail(null); }}
              className={`px-3 py-2 text-sm rounded-lg font-medium ${tab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              Overview
            </button>
            <button onClick={() => { setTab('emails'); setSelectedEmail(null); }}
              className={`px-3 py-2 text-sm rounded-lg font-medium ${tab === 'emails' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              Emails ({emails.length})
            </button>
            <button onClick={() => { setTab('post-event'); if (!postEventData) fetchPostEvent(); }}
              className={`px-3 py-2 text-sm rounded-lg font-medium ${tab === 'post-event' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              Post-Event
            </button>
          </div>
        </div>

        {tab === 'overview' && (
          <>
            {/* Hierarchical Org Tree */}
            <div className="space-y-3 mb-6">
              {orgTree.map(org => {
                const isOrgExpanded = expandedOrg === org.name;
                return (
                  <div key={org.name} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Company Level */}
                    <div className="p-5 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                      onClick={() => setExpandedOrg(isOrgExpanded ? null : org.name)}>
                      <div>
                        <h3 className="font-semibold text-gray-800 text-lg">{org.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {org.supervisors.length} supervisor{org.supervisors.length !== 1 ? 's' : ''} · {org.reps.length} rep{org.reps.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="grid grid-cols-5 gap-3 text-center">
                          <div><p className="text-lg font-bold text-gray-800">{org.stats.total}</p><p className="text-[10px] text-gray-400">Leads</p></div>
                          <div><p className="text-lg font-bold text-teal-600">{org.stats.approved}</p><p className="text-[10px] text-gray-400">Approved to Invite</p></div>
                          <div><p className="text-lg font-bold text-amber-600">{org.stats.invited}</p><p className="text-[10px] text-gray-400">Invited</p></div>
                          <div><p className="text-lg font-bold text-red-600">{org.stats.declined}</p><p className="text-[10px] text-gray-400">Declined</p></div>
                          <div><p className="text-lg font-bold text-purple-600">{org.stats.attended}</p><p className="text-[10px] text-gray-400">Attended</p></div>
                        </div>
                        <span className="text-gray-400 text-sm">{isOrgExpanded ? '▼' : '▶'}</span>
                      </div>
                    </div>

                    {/* Expanded: Supervisors + Reps */}
                    {isOrgExpanded && (
                      <div className="border-t border-gray-200">
                        {/* Supervisors */}
                        {org.supervisors.map(sup => (
                          <div key={sup.id} className="border-b border-gray-100">
                            <div className="px-8 py-3 bg-amber-50 flex items-center justify-between cursor-pointer hover:bg-amber-100"
                              onClick={() => setExpandedSup(expandedSup === sup.id ? null : sup.id)}>
                              <div className="flex items-center gap-2">
                                <span className="inline-block px-2 py-0.5 text-xs rounded-full font-medium bg-amber-100 text-amber-700">Supervisor</span>
                                <span className="text-sm font-medium text-gray-800">{sup.full_name}</span>
                                <span className="text-xs text-gray-400">{sup.email}</span>
                              </div>
                              <span className="text-xs text-gray-400">{expandedSup === sup.id ? '▼' : '▶'}</span>
                            </div>
                            {/* Reps under this supervisor (same org) */}
                            {expandedSup === sup.id && (
                              <div className="bg-gray-50">
                                {org.reps.length === 0 ? (
                                  <p className="px-12 py-3 text-sm text-gray-400 italic">No sales reps in this organization</p>
                                ) : org.reps.map(rep => {
                                  const isRepExpanded = expandedRep === rep.id;
                                  return (
                                    <div key={rep.id} className="border-t border-gray-200">
                                      <div className="px-12 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                                        onClick={() => setExpandedRep(isRepExpanded ? null : rep.id)}>
                                        <div className="flex items-center gap-2">
                                          <span className="inline-block px-2 py-0.5 text-xs rounded-full font-medium bg-gray-100 text-gray-600">Rep</span>
                                          <span className="text-sm text-gray-700">{rep.full_name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs text-gray-500">{rep.leads.length} lead{rep.leads.length !== 1 ? 's' : ''} · {rep.interactionCount} interactions</span>
                                          <span className="text-xs text-gray-400">{isRepExpanded ? '▼' : '▶'}</span>
                                        </div>
                                      </div>
                                      {isRepExpanded && rep.leads.length > 0 && (
                                        <div className="px-16 py-2 bg-white border-t border-gray-100">
                                          <table className="w-full">
                                            <thead>
                                              <tr>
                                                <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Lead</th>
                                                <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Company</th>
                                                <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Status</th>
                                                <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Score</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {rep.leads.map(l => (
                                                <tr key={l.id} className="border-t border-gray-100">
                                                  <td className="px-2 py-1 text-sm text-gray-700">{l.full_name}</td>
                                                  <td className="px-2 py-1 text-sm text-gray-500">{l.company_name || '-'}</td>
                                                  <td className="px-2 py-1">
                                                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[l.status] || 'bg-gray-100'}`}>{l.status === 'approved' ? 'Approved to Invite' : l.status}</span>
                                                  </td>
                                                  <td className="px-2 py-1">
                                                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-bold ${
                                                      l.lead_score_label === 'hot' ? 'bg-red-100 text-red-700' : l.lead_score_label === 'warm' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                                    }`}>{l.lead_score || 0}</span>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {/* Unassigned leads in this org */}
                                {org.unassignedLeads.length > 0 && (
                                  <div className="border-t border-gray-200">
                                    <div className="px-12 py-2.5 text-sm text-gray-500 italic">
                                      {org.unassignedLeads.length} unassigned lead{org.unassignedLeads.length !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Reps with no supervisor shown directly */}
                        {org.supervisors.length === 0 && org.reps.map(rep => {
                          const isRepExpanded = expandedRep === rep.id;
                          return (
                            <div key={rep.id} className="border-b border-gray-100">
                              <div className="px-8 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                                onClick={() => setExpandedRep(isRepExpanded ? null : rep.id)}>
                                <div className="flex items-center gap-2">
                                  <span className="inline-block px-2 py-0.5 text-xs rounded-full font-medium bg-gray-100 text-gray-600">Rep</span>
                                  <span className="text-sm text-gray-700">{rep.full_name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-gray-500">{rep.leads.length} leads · {rep.interactionCount} interactions</span>
                                  <span className="text-xs text-gray-400">{isRepExpanded ? '▼' : '▶'}</span>
                                </div>
                              </div>
                              {isRepExpanded && rep.leads.length > 0 && (
                                <div className="px-12 py-2 bg-gray-50 border-t border-gray-100">
                                  <table className="w-full">
                                    <thead><tr>
                                      <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Lead</th>
                                      <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Company</th>
                                      <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Status</th>
                                      <th className="text-left px-2 py-1 text-xs font-medium text-gray-400">Score</th>
                                    </tr></thead>
                                    <tbody>
                                      {rep.leads.map(l => (
                                        <tr key={l.id} className="border-t border-gray-100">
                                          <td className="px-2 py-1 text-sm text-gray-700">{l.full_name}</td>
                                          <td className="px-2 py-1 text-sm text-gray-500">{l.company_name || '-'}</td>
                                          <td className="px-2 py-1"><span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[l.status] || 'bg-gray-100'}`}>{l.status === 'approved' ? 'Approved to Invite' : l.status}</span></td>
                                          <td className="px-2 py-1"><span className={`inline-block px-2 py-0.5 text-xs rounded-full font-bold ${l.lead_score_label === 'hot' ? 'bg-red-100 text-red-700' : l.lead_score_label === 'warm' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{l.lead_score || 0}</span></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              {['all', 'possible', 'approved', 'invited', 'accepted', 'declined', 'attended'].map(f => (
                <button key={f} onClick={() => { setFilter(f); setRptPage(1); }}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium ${filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {f === 'all' ? 'All' : f === 'approved' ? 'Approved to Invite' : f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? customers.length : customers.filter(c => c.status === f).length})
                </button>
              ))}
            </div>

            {/* Master Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {[
                        { key: 'full_name', label: 'Name' }, { key: 'company_name', label: 'Org' },
                        { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' },
                        { key: 'organization_name', label: 'Sales Org' }, { key: 'created_at', label: 'Added' },
                      ].map(col => (
                        <th key={col.key} onClick={() => toggleSort(col.key)}
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700">
                          {col.label} {sortBy === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                        </th>
                      ))}
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Emails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                    ) : sorted.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No data</td></tr>
                    ) : paginate(sorted, rptPage, rptPageSize).map(c => {
                      const emailCount = emails.filter(e => e.customer_id === c.id).length;
                      return (
                        <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.full_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{c.company_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[c.status] || 'bg-gray-100'}`}>
                              {c.status === 'approved' ? 'Approved to Invite' : c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{c.organization_name}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-right">
                            {emailCount > 0 ? (
                              <button onClick={() => { setTab('emails'); setEmailFilter(c.email); }}
                                className="text-xs text-indigo-600 hover:text-indigo-800">
                                {emailCount} email{emailCount !== 1 ? 's' : ''}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300">0</span>
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
                {/* Sort controls for mobile */}
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-xs overflow-x-auto">
                  <span className="text-gray-400 shrink-0">Sort:</span>
                  {[
                    { key: 'full_name', label: 'Name' }, { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Date' },
                  ].map(col => (
                    <button key={col.key} onClick={() => toggleSort(col.key)}
                      className={`px-2 py-1 rounded shrink-0 ${sortBy === col.key ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-500'}`}>
                      {col.label} {sortBy === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  ))}
                </div>
                {loading ? (
                  <p className="p-6 text-center text-gray-400">Loading...</p>
                ) : sorted.length === 0 ? (
                  <p className="p-6 text-center text-gray-400">No data</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {sorted.map(c => {
                      const emailCount = emails.filter(e => e.customer_id === c.id).length;
                      return (
                        <div key={c.id} className="p-4 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-900 truncate">{c.full_name}</p>
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ml-2 ${statusColors[c.status] || 'bg-gray-100'}`}>
                              {c.status === 'approved' ? 'Approved to Invite' : c.status}
                            </span>
                          </div>
                          {c.company_name && <p className="text-xs text-gray-500 truncate">{c.company_name}</p>}
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div className="col-span-2"><dt className="text-gray-400 inline">Email:</dt> <dd className="text-gray-700 inline truncate">{c.email}</dd></div>
                            {c.organization_name && <div><dt className="text-gray-400 inline">Sales Org:</dt> <dd className="text-gray-700 inline">{c.organization_name}</dd></div>}
                            <div><dt className="text-gray-400 inline">Added:</dt> <dd className="text-gray-700 inline">{new Date(c.created_at).toLocaleDateString()}</dd></div>
                          </dl>
                          {emailCount > 0 && (
                            <button onClick={() => { setTab('emails'); setEmailFilter(c.email); }}
                              className="text-xs text-indigo-600 font-medium pt-0.5">
                              {emailCount} email{emailCount !== 1 ? 's' : ''} →
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <Pagination totalItems={sorted.length} page={rptPage} pageSize={rptPageSize}
                onPageChange={setRptPage} onPageSizeChange={setRptPageSize} />
            </div>
          </>
        )}

        {tab === 'emails' && !selectedEmail && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <input
                type="text" placeholder="Search emails by recipient, name, subject..."
                value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
              {emailFilter && (
                <button onClick={() => setEmailFilter('')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">Clear</button>
              )}
            </div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Direction</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">To/From</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Lead</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Subject</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmails.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No emails logged yet</td></tr>
                  ) : paginate(filteredEmails, emlPage, emlPageSize).map(e => (
                    <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                          e.direction === 'outbound' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {e.direction === 'outbound' ? 'Sent' : 'Received'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.direction === 'outbound' ? e.to : e.from}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{e.customer_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{e.subject}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{e.type}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => viewEmail(e.id)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden">
              {filteredEmails.length === 0 ? (
                <p className="p-6 text-center text-gray-400">No emails logged yet</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {paginate(filteredEmails, emlPage, emlPageSize).map(e => (
                    <div key={e.id} className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ${
                            e.direction === 'outbound' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {e.direction === 'outbound' ? 'Sent' : 'Recv'}
                          </span>
                          <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 shrink-0">{e.type}</span>
                        </div>
                        <button onClick={() => viewEmail(e.id)}
                          className="text-xs text-indigo-600 font-medium shrink-0 ml-2">
                          View
                        </button>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{e.customer_name}</p>
                      <p className="text-xs text-gray-600 truncate">{e.subject}</p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="truncate">{e.direction === 'outbound' ? e.to : e.from}</span>
                        <span className="shrink-0 ml-2">{new Date(e.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Pagination totalItems={filteredEmails.length} page={emlPage} pageSize={emlPageSize}
              onPageChange={setEmlPage} onPageSizeChange={setEmlPageSize} />
          </div>
        )}

        {tab === 'emails' && selectedEmail && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Email header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <button onClick={() => setSelectedEmail(null)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                ← Back to email list
              </button>
              <button onClick={printEmail}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                Print / Save as PDF
              </button>
            </div>

            {/* Email metadata */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{selectedEmail.subject}</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">From:</span> <span className="text-gray-800">{selectedEmail.from}</span></div>
                <div><span className="text-gray-500">To:</span> <span className="text-gray-800">{selectedEmail.to}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="text-gray-800">{new Date(selectedEmail.created_at).toLocaleString()}</span></div>
                <div><span className="text-gray-500">Type:</span> <span className="text-gray-800">{selectedEmail.type} ({selectedEmail.direction})</span></div>
                <div><span className="text-gray-500">Lead:</span> <span className="text-gray-800">{selectedEmail.customer_name}</span></div>
                <div><span className="text-gray-500">Event:</span> <span className="text-gray-800">{selectedEmail.event_name}</span></div>
                {selectedEmail.sent_by && <div><span className="text-gray-500">Sent by:</span> <span className="text-gray-800">{selectedEmail.sent_by}</span></div>}
              </div>
            </div>

            {/* Email body rendered as PDF-like preview */}
            <div className="p-6">
              <div
                ref={previewRef}
                className="mx-auto bg-white border border-gray-300 shadow-md rounded-lg p-8"
                style={{ maxWidth: '650px', minHeight: '400px' }}
              >
                <div dangerouslySetInnerHTML={{ __html: emailHtml }} />
              </div>
            </div>
          </div>
        )}
        {tab === 'post-event' && (
          <>
            {postEventLoading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-gray-400 mt-3 text-sm">Loading post-event data...</p>
              </div>
            ) : !postEventData ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <p className="text-gray-400">Failed to load data. <button onClick={fetchPostEvent} className="text-indigo-600 underline">Retry</button></p>
              </div>
            ) : (
              <>
                {/* Event Summary Header */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{postEventData.event?.name || 'Event'}</h2>
                      <p className="text-sm text-gray-500">
                        {postEventData.event?.event_date || 'N/A'} · {postEventData.attendees.length} attendees · {postEventData.total_interactions} total interactions
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={downloadCSV}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                        Download CSV
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Attendee List */}
                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700">Attendees & Interactions</h3>
                      </div>
                      {postEventData.attendees.length === 0 ? (
                        <p className="p-6 text-center text-gray-400 text-sm">No attendees recorded yet</p>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {postEventData.attendees.map(a => (
                            <div key={a.id}
                              onClick={() => setSelectedAttendee(selectedAttendee?.id === a.id ? null : a)}
                              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedAttendee?.id === a.id ? 'bg-indigo-50' : ''}`}>
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-gray-900">{a.full_name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {a.title && <span className="text-xs text-indigo-600">{a.title}</span>}
                                    {a.title && a.company_name && <span className="text-xs text-gray-300">·</span>}
                                    {a.company_name && <span className="text-xs text-gray-500">{a.company_name}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className="text-xs text-gray-400">{a.interaction_count} note{a.interaction_count !== 1 ? 's' : ''}</span>
                                  <span className="text-xs text-gray-300">{selectedAttendee?.id === a.id ? '▲' : '▼'}</span>
                                </div>
                              </div>

                              {/* Reps who interacted */}
                              {a.reps.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {a.reps.map(r => (
                                    <span key={r.id} className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-indigo-100 text-indigo-700 font-medium">
                                      {r.name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Expanded: show all interactions */}
                              {selectedAttendee?.id === a.id && (
                                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3" onClick={(e) => e.stopPropagation()}>
                                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                                    {a.email && <div className="col-span-2"><dt className="text-gray-400 inline">Email:</dt> <dd className="text-gray-700 inline">{a.email}</dd></div>}
                                    {a.phone && <div><dt className="text-gray-400 inline">Phone:</dt> <dd className="text-gray-700 inline">{a.phone}</dd></div>}
                                    <div><dt className="text-gray-400 inline">Emails sent:</dt> <dd className="text-gray-700 inline">{a.email_count}</dd></div>
                                  </dl>
                                  {a.interactions.length === 0 ? (
                                    <p className="text-xs text-gray-300">No interaction notes</p>
                                  ) : a.interactions.map(i => (
                                    <div key={i.id} className="p-2.5 bg-gray-50 rounded-lg">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-gray-600">{i.sales_rep_name || 'System'}</span>
                                        <span className="text-[10px] text-gray-400">{new Date(i.created_at).toLocaleString()}</span>
                                      </div>
                                      {i.notes && <p className="text-xs text-gray-700 whitespace-pre-wrap">{i.notes}</p>}
                                      {!i.notes && <p className="text-xs text-gray-400 italic">{i.interaction_type?.replace('_', ' ')}</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rep Selection Panel */}
                  <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-4">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700">Send Reports to Reps</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Each rep receives a report of attendees they interacted with</p>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {postEventData.reps.length === 0 ? (
                          <p className="p-4 text-xs text-gray-400 text-center">No reps found</p>
                        ) : postEventData.reps.map(r => {
                          // Count how many attendees this rep interacted with
                          const repAttendeeCount = postEventData.attendees.filter(a =>
                            a.reps.some(ar => ar.id === r.id)
                          ).length;
                          return (
                            <label key={r.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${selectedReps.has(r.id) ? 'bg-indigo-50' : ''}`}>
                              <input type="checkbox" checked={selectedReps.has(r.id)} onChange={() => toggleRep(r.id)}
                                className="rounded border-gray-300 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{r.full_name}</p>
                                <p className="text-xs text-gray-400 truncate">{r.email}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`text-xs font-medium ${repAttendeeCount > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                                  {repAttendeeCount}
                                </span>
                                <p className="text-[10px] text-gray-400">attendees</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="p-4 border-t border-gray-200 space-y-2">
                        <button onClick={sendReports} disabled={selectedReps.size === 0 || postEventSending}
                          className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                          {postEventSending ? 'Sending...' : `Email Reports to ${selectedReps.size} Rep${selectedReps.size !== 1 ? 's' : ''}`}
                        </button>
                        <button onClick={() => {
                          const allRepIds = postEventData.reps.filter(r =>
                            postEventData.attendees.some(a => a.reps.some(ar => ar.id === r.id))
                          ).map(r => r.id);
                          setSelectedReps(new Set(allRepIds));
                        }}
                          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700">
                          Select all reps with interactions
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
